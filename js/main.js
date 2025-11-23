const API_BASE = '';

let currentUser = null;
let currentSummary = '';
let currentQuiz = '';

// DOM elements
const authForms = document.getElementById('auth-forms');
const mainApp = document.getElementById('main-app');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const showLogin = document.getElementById('show-login');
const showSignup = document.getElementById('show-signup');
const transcriptInput = document.getElementById('transcript-input');
const summarizeBtn = document.getElementById('summarize-btn');
const summaryOutput = document.getElementById('summary-output');
const quizBtn = document.getElementById('quiz-btn');
const quizOutput = document.getElementById('quiz-output');
const saveBtn = document.getElementById('save-btn');
const logoutBtn = document.getElementById('logout-btn');

// Toggle forms
showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.parentElement.style.display = 'none';
    loginForm.parentElement.style.display = 'block';
});
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.parentElement.style.display = 'none';
    signupForm.parentElement.style.display = 'block';
});

// Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;

    const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    alert(data.message || data.error);
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
        currentUser = data.user_id;
        localStorage.setItem('currentUser', currentUser);
        authForms.style.display = 'none';
        mainApp.style.display = 'block';
    } else {
        alert(data.error);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    authForms.style.display = 'block';
    mainApp.style.display = 'none';
});

// Summarize
summarizeBtn.addEventListener('click', async () => {
    const transcript = transcriptInput.value.trim();
    if (!transcript) return alert('Paste transcript first.');

    summaryOutput.textContent = "Summarizing...";
    const res = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
    });
    const data = await res.json();

    if (res.ok) {
        currentSummary = data.summary;
        summaryOutput.textContent = currentSummary;
        quizBtn.style.display = 'inline-block';
    } else {
        summaryOutput.textContent = "Error: " + data.error;
    }
});

// Quiz
quizBtn.addEventListener('click', async () => {
    const transcript = transcriptInput.value.trim();
    if (!transcript) return;

    quizOutput.textContent = "Generating quiz...";
    const res = await fetch(`${API_BASE}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
    });
    const data = await res.json();

    if (res.ok) {
        currentQuiz = data.quiz;
        quizOutput.textContent = currentQuiz;
        saveBtn.style.display = 'inline-block';
    } else {
        quizOutput.textContent = "Error: " + data.error;
    }
});

// Save & PDF
saveBtn.addEventListener('click', async () => {
    if (!currentUser) return alert('Login first.');
    const transcript = transcriptInput.value.trim();
    const title = transcript.split(" ").slice(0, 5).join(" ") + "...";

    await fetch(`${API_BASE}/save_lecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser, title, transcript, summary: currentSummary, quiz: currentQuiz })
    });

    generatePDF(transcript, currentSummary, currentQuiz);
});

// PDF generator (client-side)
function generatePDF(transcript, summary, quiz) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("EduSync Lecture Notes", 105, 15, { align: "center" });

    doc.setFontSize(12);
    doc.text("Transcript:", 10, 30);
    doc.text(doc.splitTextToSize(transcript, 180), 10, 40);

    doc.addPage();
    doc.text("Summary:", 10, 20);
    doc.text(doc.splitTextToSize(summary, 180), 10, 30);

    doc.addPage();
    doc.text("Quiz:", 10, 20);
    doc.text(doc.splitTextToSize(quiz, 180), 10, 30);

    doc.save("lecture.pdf");
}

// Restore session
window.addEventListener('load', () => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        currentUser = saved;
        authForms.style.display = 'none';
        mainApp.style.display = 'block';
    }
});
