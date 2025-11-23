# app.py
from flask import Flask, request, jsonify, send_from_directory, send_file
import sqlite3
import os
from dotenv import load_dotenv
from groq import Groq

# Optional PDF generation (server-side fallback)
from fpdf import FPDF
import tempfile

# Load environment
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in .env")

# Flask app
app = Flask(__name__, static_url_path='', static_folder='static')

# Database setup
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS lectures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            transcript TEXT NOT NULL,
            summary TEXT,
            quiz TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# Groq client
client = Groq(api_key=GROQ_API_KEY)

# Helpers
def call_groq(system_prompt, user_prompt, max_tokens=400, model="llama-3.1-8b-instant"):
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=max_tokens
    )
    return resp.choices[0].message.content.strip()

# Routes
@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        return jsonify({'message': 'User created successfully'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password)).fetchone()
    conn.close()

    if user:
        return jsonify({'message': 'Login successful', 'user_id': user['id']}), 200
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.get_json()
    transcript = data.get('transcript', '').strip()

    if not transcript:
        return jsonify({'error': 'Transcript required'}), 400

    system_prompt = (
        "You are a helpful lecture summarizer. "
        "Summarize the transcript clearly, structured with key points and takeaways."
    )
    summary = call_groq(system_prompt, transcript, max_tokens=400)
    return jsonify({'summary': summary}), 200

@app.route('/quiz', methods=['POST'])
def quiz():
    data = request.get_json()
    transcript = data.get('transcript', '').strip()

    if not transcript:
        return jsonify({'error': 'Transcript required'}), 400

    system_prompt = (
        "You are a quiz generator. Create 5 multiple-choice questions (A-D) from the transcript. "
        "Return a valid JSON with structure: {\"questions\":[{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":\"...\"}]}"
    )
    quiz_json = call_groq(system_prompt, transcript, max_tokens=600)
    return jsonify({'quiz': quiz_json}), 200

@app.route('/save_lecture', methods=['POST'])
def save_lecture():
    data = request.get_json()
    user_id = data.get('user_id')
    title = data.get('title', 'Untitled Lecture')
    transcript = data.get('transcript')
    summary = data.get('summary')
    quiz = data.get('quiz')

    if not user_id or not transcript:
        return jsonify({'error': 'Missing user_id or transcript'}), 400

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO lectures (user_id, title, transcript, summary, quiz) VALUES (?, ?, ?, ?, ?)",
        (user_id, title, transcript, summary, quiz)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Lecture saved successfully'}), 201

@app.route('/lectures/<int:user_id>', methods=['GET'])
def get_lectures(user_id):
    conn = get_db_connection()
    lectures = conn.execute("SELECT * FROM lectures WHERE user_id=? ORDER BY created_at DESC", (user_id,)).fetchall()
    conn.close()
    return jsonify({'lectures': [dict(row) for row in lectures]}), 200

# Optional: server PDF (frontend already downloads client-side)
@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    data = request.get_json()
    transcript, summary, quiz = data.get('transcript', ''), data.get('summary', ''), data.get('quiz', '')

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 8, f"Transcript:\n{transcript}\n\nSummary:\n{summary}\n\nQuiz:\n{quiz}")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(tmp.name)
    return send_file(tmp.name, as_attachment=True, download_name="lecture.pdf")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
