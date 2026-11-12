const app = document.getElementById('app');
let S = {
  token: localStorage.getItem('ef_token') || '',
  user: JSON.parse(localStorage.getItem('ef_user') || 'null')
};
let activeTab = 0;
let modalContent = null;
let E = null; // Exam taking state
let F = { course: 0, drafts: [], qs: [], selectedQs: new Set() }; // Faculty state
let timerInterval = null;
let saverInterval = null;

// Utility functions
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Course-Based Visual Theming Helper
function getCourseTheme(code = '', name = '') {
  const str = (code + ' ' + name).toLowerCase();
  if (str.includes('python') || str.includes('py') || str.includes('ai') || str.includes('ml')) {
    return {
      themeClass: 'course-theme-python',
      icon: '🐍',
      tag: 'Python & AI',
      color: '#059669',
      lightColor: '#ecfdf5'
    };
  }
  if (str.includes('sql') || str.includes('db') || str.includes('rdbms') || str.includes('data')) {
    return {
      themeClass: 'course-theme-sql',
      icon: '🗄️',
      tag: 'Databases & SQL',
      color: '#0284c7',
      lightColor: '#f0f9ff'
    };
  }
  if (str.includes('algo') || str.includes('cs') || str.includes('dsa') || str.includes('os') || str.includes('sys')) {
    return {
      themeClass: 'course-theme-algo',
      icon: '⚡',
      tag: 'Computer Science',
      color: '#7c3aed',
      lightColor: '#f5f3ff'
    };
  }
  return {
    themeClass: 'course-theme-general',
    icon: '📘',
    tag: 'Academic Track',
    color: '#4f46e5',
    lightColor: '#eef2ff'
  };
}

function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : '⚠';
  t.innerHTML = `<span style="font-size: 1.1rem;">${icon}</span><span>${esc(message)}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(50px)';
    t.style.transition = 'all 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

async function api(path, method = 'GET', body = null) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  try {
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined)
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
      if (res.status === 401 && S.token) {
        logout();
      }
      throw new Error((data && data.error) ? data.error : 'Request failed');
    }
    return data;
  } catch (err) {
    toast(err.message, 'error');
    throw err;
  }
}

function logout() {
  localStorage.removeItem('ef_token');
  localStorage.removeItem('ef_user');
  S = { token: '', user: null };
  if (timerInterval) clearInterval(timerInterval);
  if (saverInterval) clearInterval(saverInterval);
  E = null;
  activeTab = 0;
  window.location.hash = '';
  render();
  toast('Logged out successfully');
}

function setAuth(token, user) {
  S.token = token;
  S.user = user;
  localStorage.setItem('ef_token', token);
  localStorage.setItem('ef_user', JSON.stringify(user));
  render();
}

function setAuth(token, user) {
  S.token = token;
  S.user = user;
  localStorage.setItem('ef_token', token);
  localStorage.setItem('ef_user', JSON.stringify(user));
  render();
}

// Global SVG Icons
function googleSvgIcon() {
  return `
    <svg class="google-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  `;
}

// Global Footer
function renderFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-col">
          <div class="flex items-center gap-2 mb-4">
            <div class="brand-icon" style="width: 32px; height: 32px; font-size: 1rem;">⚡</div>
            <div class="brand-title" style="font-size: 1.15rem;">ExamFlow</div>
            <span class="brand-badge">PRO</span>
          </div>
          <p class="text-sm text-muted" style="line-height: 1.6; max-width: 380px;">
            An enterprise-grade academic assessment and examination engine built for 1,000+ concurrent students, automated question paper ingestion from PDF/DOCX, and uncompromising academic integrity.
          </p>
          <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 6px var(--success);"></span>
            <span class="text-xs font-bold" style="color: var(--success);">All Systems Operational • PostgreSQL 16 Active</span>
          </div>
        </div>
        <div class="footer-col">
          <h5>Navigation</h5>
          <ul class="footer-links">
            <li><a href="#/">🏠 Home Landing</a></li>
            <li><a href="#/features">⚡ All Features</a></li>
            <li><a href="#/about">📖 About & Mission</a></li>
            <li><a href="#/login">🔑 Sign In</a></li>
            <li><a href="#/register">📝 Role Registration</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h5>Portals</h5>
          <ul class="footer-links">
            <li><a href="#/register" data-a="switch-reg-tab" data-role="student">🎓 Student Registration</a></li>
            <li><a href="#/register" data-a="switch-reg-tab" data-role="faculty">👨‍🏫 Faculty Registration</a></li>
            <li><a href="#/login">👑 Admin Management</a></li>
            <li><a href="#/features">📄 Smart Question Extractor</a></li>
            <li><a href="#/features">🛡️ Anti-Cheat Suite</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h5>Core Architecture</h5>
          <ul class="footer-links">
            <li><span class="text-sm text-muted">1,000+ Concurrency Engine</span></li>
            <li><span class="text-sm text-muted">PostgreSQL 16 Multiplexing</span></li>
            <li><span class="text-sm text-muted">PDF / Word Ingestion</span></li>
            <li><span class="text-sm text-muted">Full-Screen Anti-Tamper</span></li>
            <li><span class="text-sm text-muted">Real-Time Gradebook & CSV</span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© 2026 ExamFlow Educational Technologies. Built for Academic Excellence.</div>
        <div class="flex gap-4">
          <a href="#/about" class="text-muted" style="text-decoration:none;">Mission</a>
          <a href="#/features" class="text-muted" style="text-decoration:none;">Features</a>
          <a href="#/login" class="text-muted" style="text-decoration:none;">Sign In</a>
        </div>
      </div>
    </footer>
  `;
}

// Shell layout
function shell(content, options = {}) {
  const hash = window.location.hash || '#/';
  const roleClass = S.user ? `role-${S.user.role}` : '';
  const isHome = hash === '' || hash === '#/' || hash.startsWith('#/#');
  const isFeatures = hash === '#/features';
  const isAbout = hash === '#/about';
  const isDashboard = hash === '#/dashboard';
  const isProfile = hash === '#/profile';

  return `
    <header>
      <div class="header-inner">
        <div class="flex items-center gap-4">
          <a href="${S.user ? '#/dashboard' : '#/'}" class="brand">
            <div class="brand-icon">⚡</div>
            <div class="brand-title">ExamFlow</div>
            <span class="brand-badge">PRO</span>
          </a>
          <nav class="nav-group">
            <ul class="nav-links">
              <li><a href="#/" class="nav-link ${isHome ? 'active' : ''}">🏠 Home</a></li>
              <li><a href="#/features" class="nav-link ${isFeatures ? 'active' : ''}">⚡ Features</a></li>
              <li><a href="#/about" class="nav-link ${isAbout ? 'active' : ''}">📖 About & Mission</a></li>
              ${S.user ? `<li><a href="#/dashboard" class="nav-link ${isDashboard ? 'active' : ''}">📊 Dashboard</a></li>` : ''}
            </ul>
          </nav>
        </div>

        <div>
          ${S.user ? `
            <div class="user-profile">
              <a href="#/profile" class="user-meta" style="text-decoration: none; cursor: pointer; text-align: right;">
                <div class="user-name" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem;">
                  <span>${S.user.role === 'admin' ? '👑' : (S.user.role === 'faculty' ? '👨‍🏫' : '🎓')}</span>
                  <span>${esc(S.user.name)}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem; margin-top: 2px;">
                  <span class="user-role-pill ${roleClass}">${esc(S.user.role)}</span>
                  ${S.user.department ? `<span class="text-xs text-muted" style="font-size: 0.72rem;">• ${esc(S.user.department)}</span>` : ''}
                </div>
              </a>
              <div class="flex gap-2 items-center">
                <a href="#/profile" class="btn btn-sm btn-outline" style="${isProfile ? 'border-color: var(--primary); color: var(--primary); font-weight: 700;' : ''}">
                  👤 Profile
                </a>
                <button class="btn btn-sm btn-outline" data-a="logout">Logout</button>
              </div>
            </div>
          ` : `
            <div class="flex gap-2 items-center">
              <a href="#/login" class="btn btn-sm btn-outline">Sign In</a>
              <a href="#/register" class="btn btn-sm btn-primary">Register Free</a>
            </div>
          `}
        </div>
      </div>
    </header>

    <main style="${options.fullWidth ? 'max-width: 100%; padding: 0;' : ''}">
      ${content}
    </main>

    ${(!options.noFooter && !E) ? renderFooter() : ''}

    ${modalContent ? `
      <div class="modal-backdrop" id="modal-backdrop" data-a="close-modal">
        <div class="modal-box" onclick="event.stopPropagation()">
          ${modalContent}
        </div>
      </div>
    ` : ''}
  `;
}

// Router & State Render
window.addEventListener('hashchange', render);

async function render() {
  const hash = window.location.hash || '';

  // Public Share Join Route: #/join/CODE
  if (hash.startsWith('#/join/')) {
    const code = hash.replace('#/join/', '').trim();
    return renderJoinPage(code);
  }

  // Active in-progress Exam View (student actively writing an exam)
  if (E) {
    return renderExamTaker();
  }

  // All Features Page
  if (hash === '#/features') {
    return renderFeaturesPage();
  }

  // About & Problem/Solution Page
  if (hash === '#/about') {
    return renderAboutPage();
  }

  // Dedicated Login View
  if (hash === '#/login') {
    if (S.user) {
      window.location.hash = '#/dashboard';
      return;
    }
    return renderLogin();
  }

  // Dedicated Registration View
  if (hash.startsWith('#/register')) {
    if (S.user) {
      window.location.hash = '#/dashboard';
      return;
    }
    const isFaculty = hash.includes('faculty');
    return renderRegister(isFaculty ? 'faculty' : 'student');
  }

  // User Profile Page
  if (hash === '#/profile') {
    if (!S.user) {
      window.location.hash = '#/login';
      return;
    }
    return renderProfilePage();
  }

  // Role Dashboard View
  if (hash === '#/dashboard') {
    if (!S.user) {
      window.location.hash = '#/login';
      return;
    }
    return renderDashboard();
  }

  // Root / Home Route: #/ or empty
  if (hash === '' || hash === '#/' || hash.startsWith('#/#')) {
    if (S.user) {
      return renderDashboard();
    } else {
      return renderHomePage();
    }
  }

  // Default fallback
  if (S.user) return renderDashboard();
  return renderHomePage();
}

async function renderDashboard() {
  if (!S.user) return renderLogin();
  if (S.user.role === 'admin') await renderAdmin();
  else if (S.user.role === 'faculty') await renderFaculty();
  else if (S.user.role === 'student') await renderStudent();
}

// Google Auth Modal
function openGoogleAuthModal(defaultRole = 'student') {
  modalContent = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">
        <svg style="width: 44px; height: 44px;" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Sign in with Google</h3>
      <p class="text-sm text-muted" style="margin-top: 4px;">Sign in or create an account with your official institutional email</p>
    </div>

    <form data-f="google-auth">
      <div class="form-group">
        <label class="form-label" style="font-weight: 600;">Google Account Email</label>
        <input type="email" name="email" class="form-control" placeholder="your.name@gmail.com or @college.edu" required>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600;">Full Name</label>
        <input type="text" name="name" class="form-control" placeholder="Your Full Name" required>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-weight: 600;">Account Role</label>
        <select name="role" class="form-control" style="font-weight: 600;">
          <option value="student" ${defaultRole === 'student' ? 'selected' : ''}>🎓 Student (Attempting Exams)</option>
          <option value="faculty" ${defaultRole === 'faculty' ? 'selected' : ''}>👨‍🏫 Faculty (Authoring Exams & Analytics)</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.75rem;">
        Authorize & Continue with Google
      </button>
    </form>
  `;
  render();
}

// ---------- HOME LANDING PAGE ----------
function renderHomePage() {
  app.innerHTML = shell(`
    <div class="hero-container">
      <div class="hero-badge">
        <span>⚡</span> Engineered for 1,000+ Concurrent Students • Anti-Cheat Integrity
      </div>
      <h1 class="hero-title">
        The Intelligent Assessment Platform<br>
        <span class="gradient-text">Engineered for Academic Excellence</span>
      </h1>
      <p class="hero-subtitle">
        Empower your institution with resilient, high-concurrency exams, automated question paper ingestion from Word & PDF documents, and distraction-free academic integrity.
      </p>
      <div class="hero-actions">
        <a href="#/register" data-a="switch-reg-tab" data-role="student" class="btn btn-primary" style="font-size: 1rem; padding: 0.85rem 1.75rem;">
          🎓 Register as Student
        </a>
        <a href="#/register" data-a="switch-reg-tab" data-role="faculty" class="btn btn-secondary" style="font-size: 1rem; padding: 0.85rem 1.75rem;">
          👨‍🏫 Faculty Portal
        </a>
        <a href="#/features" class="btn btn-outline" style="font-size: 1rem; padding: 0.85rem 1.75rem;">
          ⚡ Explore All Features
        </a>
      </div>

      <!-- Live Metric Chips -->
      <div class="metrics-bar">
        <div class="metric-chip">
          <div class="metric-val">1,000+</div>
          <div class="metric-lbl">Concurrent Test Takers</div>
        </div>
        <div class="metric-chip">
          <div class="metric-val">10x</div>
          <div class="metric-lbl">Faster Paper Extraction</div>
        </div>
        <div class="metric-chip">
          <div class="metric-val">&lt; 15ms</div>
          <div class="metric-lbl">Delta Response Latency</div>
        </div>
        <div class="metric-chip">
          <div class="metric-val">99.98%</div>
          <div class="metric-lbl">Integrity & Uptime Score</div>
        </div>
      </div>
    </div>

    <!-- On-Page Registration & Quick Access Hub -->
    <div id="register-hub" style="max-width: 760px; margin: 0 auto 4rem;">
      <div class="card" style="box-shadow: var(--shadow-xl); border-radius: var(--radius-lg); border: 1px solid var(--border); padding: 2.25rem;">
        <div class="text-center" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">Get Started with ExamFlow</h2>
          <p class="text-muted text-sm" style="margin-top: 4px;">Choose your role to register your official institutional profile</p>
        </div>

        <div class="role-tabs">
          <button type="button" class="role-tab-btn active" id="tab-btn-student" data-a="switch-reg-tab" data-role="student">
            🎓 Student Registration
          </button>
          <button type="button" class="role-tab-btn" id="tab-btn-faculty" data-a="switch-reg-tab" data-role="faculty">
            👨‍🏫 Faculty Registration
          </button>
        </div>

        <!-- Student Registration Form -->
        <div id="reg-box-student">
          <button type="button" class="google-btn" data-a="open-google-auth" data-role="student" style="margin-bottom: 1.25rem;">
            ${googleSvgIcon()}
            Continue with Google as Student
          </button>

          <div style="position: relative; text-align: center; margin: 1.25rem 0;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border);"></div>
            <span style="position: relative; background: var(--surface); padding: 0 0.75rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OR REGISTER WITH DETAILS</span>
          </div>

          <form data-f="register">
            <input type="hidden" name="role" value="student">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Full Name *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Rahul Sharma" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">College Email *</label>
                <input type="email" name="email" class="form-control" placeholder="rahul@college.edu" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Roll Number / Student ID *</label>
                <input type="text" name="roll_number" class="form-control" placeholder="e.g. 2451-22-733-045" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Department / Branch *</label>
                <select name="department" class="form-control" required style="font-weight: 600;">
                  <option value="">Select Branch...</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                  <option value="Information Technology">Information Technology (IT)</option>
                  <option value="Artificial Intelligence & ML">Artificial Intelligence & ML (AI&ML)</option>
                  <option value="Data Science">Data Science (DS)</option>
                  <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                  <option value="Electrical Engineering">Electrical & Electronics (EEE)</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Year / Semester *</label>
                <select name="year_sem" class="form-control" required style="font-weight: 600;">
                  <option value="1st Year - Sem 1">1st Year - Sem 1</option>
                  <option value="1st Year - Sem 2">1st Year - Sem 2</option>
                  <option value="2nd Year - Sem 1">2nd Year - Sem 1</option>
                  <option value="2nd Year - Sem 2">2nd Year - Sem 2</option>
                  <option value="3rd Year - Sem 1" selected>3rd Year - Sem 1</option>
                  <option value="3rd Year - Sem 2">3rd Year - Sem 2</option>
                  <option value="4th Year - Sem 1">4th Year - Sem 1</option>
                  <option value="4th Year - Sem 2">4th Year - Sem 2</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Mobile Number</label>
                <input type="tel" name="phone" class="form-control" placeholder="+91 9876543210">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Password (8+ characters) *</label>
              <input type="password" name="password" class="form-control" placeholder="••••••••••••" minlength="8" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; font-size: 1rem; padding: 0.85rem; font-weight: 700; margin-top: 0.5rem;">
              🎓 Register Student Profile & Start Learning
            </button>
          </form>
        </div>

        <!-- Faculty Registration Form -->
        <div id="reg-box-faculty" style="display: none;">
          <button type="button" class="google-btn" data-a="open-google-auth" data-role="faculty" style="margin-bottom: 1.25rem;">
            ${googleSvgIcon()}
            Continue with Google as Faculty
          </button>

          <div style="position: relative; text-align: center; margin: 1.25rem 0;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border);"></div>
            <span style="position: relative; background: var(--surface); padding: 0 0.75rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OR REGISTER WITH ACADEMIC CREDENTIALS</span>
          </div>

          <form data-f="register">
            <input type="hidden" name="role" value="faculty">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Faculty Full Name & Title *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Dr. K. S. Rao" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Institutional Email *</label>
                <input type="email" name="email" class="form-control" placeholder="ksrao@mvsrec.edu.in" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Employee / Faculty Code *</label>
                <input type="text" name="employee_id" class="form-control" placeholder="e.g. FAC-CSE-204" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Department *</label>
                <select name="department" class="form-control" required style="font-weight: 600;">
                  <option value="">Select Academic Department...</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical Engineering">Electrical & Electronics</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Applied Sciences">Applied Sciences & Humanities</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Designation *</label>
                <select name="designation" class="form-control" required style="font-weight: 600;">
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor" selected>Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Professor & Head of Department">Professor & HOD</option>
                  <option value="Dean of Academics">Dean of Academics</option>
                  <option value="Visiting Faculty">Visiting Faculty / Lecturer</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Primary Subject / Specialization</label>
                <input type="text" name="specialization" class="form-control" placeholder="e.g. Data Structures & Algorithms">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Contact Phone</label>
                <input type="tel" name="phone" class="form-control" placeholder="+91 9876543210">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Password (8+ chars) *</label>
                <input type="password" name="password" class="form-control" placeholder="••••••••••••" minlength="8" required>
              </div>
            </div>

            <button type="submit" class="btn btn-secondary" style="width: 100%; font-size: 1rem; padding: 0.85rem; font-weight: 700; margin-top: 0.5rem;">
              👨‍🏫 Register Faculty Profile & Launch Studio
            </button>
          </form>
        </div>

        <div class="auth-switch" style="margin-top: 1.5rem;">
          Already have an account? <a href="#/login">Sign in with credentials</a>
        </div>
      </div>
    </div>

    <!-- The Problem We Solve vs The Solution Given -->
    <div style="margin-bottom: 4rem;">
      <div class="text-center" style="margin-bottom: 2.5rem;">
        <span class="badge badge-info" style="font-size: 0.8rem; padding: 4px 12px; margin-bottom: 0.5rem;">THE PROBLEM & OUR SOLUTION</span>
        <h2 style="font-size: 2.25rem; font-weight: 800; color: var(--text-main);">Why Modern Universities Choose ExamFlow</h2>
        <p class="text-muted" style="max-width: 680px; margin: 0 auto;">We analyzed traditional examination hurdles across universities and engineered systematic, high-performance solutions.</p>
      </div>

      <div class="split-grid">
        <div class="split-card problem">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
            <span style="font-size: 1.75rem;">🛑</span>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--danger);">The Problems in Online Testing</h3>
          </div>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 1rem; color: var(--text-main);">
            <li class="flex gap-2">
              <span style="color: var(--danger); font-weight: 700;">✕</span>
              <div><strong>Concurrency Bottlenecks:</strong> Legacy portals crash or deadlock when 200+ students click submit simultaneously.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--danger); font-weight: 700;">✕</span>
              <div><strong>Authoring Nightmare:</strong> Faculty lose 4–6 hours manually copying & pasting questions from PDF/Word papers.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--danger); font-weight: 700;">✕</span>
              <div><strong>Integrity Vulnerabilities:</strong> Students switch browser tabs, search answers, or manipulate unmonitored local timers.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--danger); font-weight: 700;">✕</span>
              <div><strong>Disconnected Portals:</strong> Separate software for enrollments, courses, question banks, and grading causes data loss.</div>
            </li>
          </ul>
        </div>

        <div class="split-card solution">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
            <span style="font-size: 1.75rem;">✅</span>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--success);">The ExamFlow Architectural Solution</h3>
          </div>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 1rem; color: var(--text-main);">
            <li class="flex gap-2">
              <span style="color: var(--success); font-weight: 700;">✓</span>
              <div><strong>1,000+ Concurrency Engine:</strong> PostgreSQL 16 pool multiplexing & micro-delta sync handling peak campus loads with zero lag.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--success); font-weight: 700;">✓</span>
              <div><strong>Smart Question Extractor:</strong> Drag & drop any Word (.docx) or PDF document to auto-parse questions, options, & answer keys in 5 seconds.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--success); font-weight: 700;">✓</span>
              <div><strong>Anti-Tamper & Anti-Cheat Suite:</strong> Fullscreen enforcement, tab-switch counter, blur detection, and server-side hard deadlines.</div>
            </li>
            <li class="flex gap-2">
              <span style="color: var(--success); font-weight: 700;">✓</span>
              <div><strong>Unified Curriculum Synchronization:</strong> Institutional Admin, Faculty Studio, and Student catalog synchronized in one real-time platform.</div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Features Showcase Cards -->
    <div style="margin-bottom: 4rem;">
      <div class="text-center" style="margin-bottom: 2.5rem;">
        <span class="badge badge-info" style="font-size: 0.8rem; padding: 4px 12px; margin-bottom: 0.5rem;">PLATFORM CAPABILITIES</span>
        <h2 style="font-size: 2.25rem; font-weight: 800; color: var(--text-main);">Built for Campus-Wide Deployment</h2>
      </div>

      <div class="feature-grid-3">
        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">🚀</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">1,000+ Concurrency Scaling</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Engineered with PostgreSQL connection multiplexing, delta-buffered response caching, and NAT-friendly token rate limits.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">Read Specs →</a></div>
        </div>

        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">📄</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">Smart File Extractor</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Drag and drop PDF or Word DOCX question papers. High-accuracy regex parser extracts questions, options, answer keys & marks automatically.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">View Extractor →</a></div>
        </div>

        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">🛡️</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">Anti-Cheat Integrity Suite</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Full-screen mode, blur detection, tab-switch penalty counters, and strict server-side deadline enforcement prevent academic malpractice.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">Explore Security →</a></div>
        </div>

        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">🔗</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">One-Click Share Links</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Generate unique shareable exam codes (#/join/CODE). Students register and auto-enroll into the course test with zero manual setup.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">Learn More →</a></div>
        </div>

        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">📊</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">Deep Analytics & CSV Gradebook</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Score distributions, percentiles, pass rates, student rankings, and single-click CSV export ready for accreditation and institutional reports.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">View Analytics →</a></div>
        </div>

        <div class="feature-card">
          <div>
            <div class="feature-icon-wrapper">🏛️</div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem;">Institutional Curriculum Sync</h4>
            <p class="text-sm text-muted" style="line-height: 1.6;">Centralized course catalog with student self-enrollment, faculty test assignment, and admin institutional management.</p>
          </div>
          <div style="margin-top: 1rem;"><a href="#/features" class="btn btn-sm btn-outline">View Architecture →</a></div>
        </div>
      </div>
    </div>
  `);
}

// ---------- ALL FEATURES PAGE ----------
function renderFeaturesPage() {
  app.innerHTML = shell(`
    <div style="padding: 2.5rem 0 1rem; text-align: center;">
      <span class="badge badge-info" style="font-size: 0.82rem; padding: 4px 12px; margin-bottom: 0.75rem;">ENGINEERING SPECIFICATIONS</span>
      <h1 style="font-size: 2.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.75rem;">
        Comprehensive Platform Features
      </h1>
      <p class="text-muted" style="max-width: 720px; margin: 0 auto 2.5rem; font-size: 1.1rem; line-height: 1.6;">
        ExamFlow combines high-throughput distributed systems engineering with intuitive design to provide the most reliable academic examination infrastructure.
      </p>
    </div>

    <div style="display: flex; flex-direction: column; gap: 2.25rem; margin-bottom: 4rem;">
      <!-- Feature 1 -->
      <div class="card" style="padding: 2rem; display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
        <div class="feature-icon-wrapper" style="width: 60px; height: 60px; font-size: 2rem;">🚀</div>
        <div style="flex: 1; min-width: 280px;">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-success">High Concurrency</span>
            <span class="badge badge-info">1,000+ Active Users</span>
          </div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">1,000 Concurrent User Scalability Engine</h3>
          <p class="text-muted" style="line-height: 1.6; margin-bottom: 1rem;">
            Online exams traditionally fail when hundreds of candidates simultaneously submit responses or refresh pages. ExamFlow solves this through:
          </p>
          <ul style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-main); font-size: 0.92rem;">
            <li><strong>PostgreSQL 16 Connection Pool Multiplexing:</strong> Scaled connection pooling (max: 100 connections) preventing thread starvation.</li>
            <li><strong>Micro-Delta Synchronization:</strong> Test taker answers sync via lightweight delta payloads (/api/attempts/:id/sync) with non-blocking row updates.</li>
            <li><strong>Campus NAT IP Awareness:</strong> Rate limiter dynamically keys off JWT Bearer tokens rather than shared college gateway IPs, allowing thousands of students on one Wi-Fi network.</li>
          </ul>
        </div>
      </div>

      <!-- Feature 2 -->
      <div class="card" style="padding: 2rem; display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
        <div class="feature-icon-wrapper" style="width: 60px; height: 60px; font-size: 2rem;">📄</div>
        <div style="flex: 1; min-width: 280px;">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-primary">Smart Ingestion</span>
            <span class="badge badge-warning">PDF • DOCX • Text</span>
          </div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Smart Question Extractor (PDF / DOCX / TXT)</h3>
          <p class="text-muted" style="line-height: 1.6; margin-bottom: 1rem;">
            Faculty can upload raw Word documents (.docx, .doc), PDF files, or plain text question papers directly:
          </p>
          <ul style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-main); font-size: 0.92rem;">
            <li><strong>Multi-Format Binary Parsing:</strong> Uses pdf-parse for PDF streams and mammoth for Word XML structures without external CLI tools.</li>
            <li><strong>Intelligent Question Pattern Detection:</strong> Automatically identifies Single Choice (Radio), Multiple Choice (Checkboxes), True/False, Marks, and Explanations.</li>
            <li><strong>Interactive Draft Review Studio:</strong> Live preview cards allowing faculty to inspect, edit, toggle inclusion, and save all questions in 1-click.</li>
          </ul>
        </div>
      </div>

      <!-- Feature 3 -->
      <div class="card" style="padding: 2rem; display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
        <div class="feature-icon-wrapper" style="width: 60px; height: 60px; font-size: 2rem;">🛡️</div>
        <div style="flex: 1; min-width: 280px;">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-danger">Security</span>
            <span class="badge badge-success">Anti-Tamper</span>
          </div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Distraction-Free Exam Integrity Suite</h3>
          <p class="text-muted" style="line-height: 1.6; margin-bottom: 1rem;">
            Ensures academic fairness during high-stakes institutional evaluations:
          </p>
          <ul style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-main); font-size: 0.92rem;">
            <li><strong>Tab Blur & Focus Monitoring:</strong> Instant warning toast and recorded violation counts whenever candidates switch tabs or minimize browsers.</li>
            <li><strong>Client-Side Fullscreen Mode:</strong> Dedicated distraction-free exam taking portal with palette question navigation and mark-for-review tags.</li>
            <li><strong>Server-Side Hard Deadlines:</strong> Exam submission timestamp is locked via LEAST(now(), deadline) preventing student device clock manipulations.</li>
          </ul>
        </div>
      </div>

      <!-- Feature 4 -->
      <div class="card" style="padding: 2rem; display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
        <div class="feature-icon-wrapper" style="width: 60px; height: 60px; font-size: 2rem;">🔗</div>
        <div style="flex: 1; min-width: 280px;">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-info">Instant Access</span>
            <span class="badge badge-primary">Share Codes</span>
          </div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Shareable One-Click Exam Links</h3>
          <p class="text-muted" style="line-height: 1.6; margin-bottom: 1rem;">
            Eliminates registration barriers for quick quizzes, lab evaluations, and surprise tests:
          </p>
          <ul style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-main); font-size: 0.92rem;">
            <li><strong>Unique Test Codes:</strong> Every published exam generates a clean URL (#/join/EXAM-CODE).</li>
            <li><strong>Auto-Enrollment Workflow:</strong> If a student is not enrolled in the course, following the link automatically enrolls them and launches the test.</li>
            <li><strong>Guest Onboarding:</strong> New candidates can register directly from the share page and immediately start the test.</li>
          </ul>
        </div>
      </div>

      <!-- Feature 5 -->
      <div class="card" style="padding: 2rem; display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
        <div class="feature-icon-wrapper" style="width: 60px; height: 60px; font-size: 2rem;">📊</div>
        <div style="flex: 1; min-width: 280px;">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-success">Live Analytics</span>
            <span class="badge badge-info">CSV Reporting</span>
          </div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Institutional Gradebook & Performance Analytics</h3>
          <p class="text-muted" style="line-height: 1.6; margin-bottom: 1rem;">
            Faculty and administrators gain actionable statistical insights with zero manual grading:
          </p>
          <ul style="padding-left: 1.25rem; line-height: 1.8; color: var(--text-main); font-size: 0.92rem;">
            <li><strong>Instant Automated Grading:</strong> Server computes scores, correct answers, wrong answers, and negative marking immediately on submission.</li>
            <li><strong>Class Distribution Metrics:</strong> Mean, highest, lowest, median score, and pass percentage computed in real-time.</li>
            <li><strong>One-Click CSV Export:</strong> Generate accredited CSV reports with student ranks, roll numbers, and audit timestamps.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="text-center" style="margin-bottom: 4rem;">
      <a href="#/register" class="btn btn-primary" style="font-size: 1.05rem; padding: 0.85rem 2rem;">
        🚀 Create Your Institutional Account Now
      </a>
    </div>
  `);
}

// ---------- ABOUT & PROBLEM/SOLUTION PAGE ----------
function renderAboutPage() {
  app.innerHTML = shell(`
    <div style="padding: 2.5rem 0 1rem; text-align: center;">
      <span class="badge badge-info" style="font-size: 0.82rem; padding: 4px 12px; margin-bottom: 0.75rem;">OUR MISSION & ORIGINS</span>
      <h1 style="font-size: 2.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.75rem;">
        About ExamFlow & The Problem We Solve
      </h1>
      <p class="text-muted" style="max-width: 720px; margin: 0 auto 2.5rem; font-size: 1.1rem; line-height: 1.6;">
        ExamFlow was created to eliminate the technical chaos of college examinations and replace broken testing workflows with rock-solid engineering.
      </p>
    </div>

    <!-- The Problem We Are Solving -->
    <div class="card" style="padding: 2.5rem; margin-bottom: 2.5rem; border-left: 6px solid var(--danger);">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
        <span style="font-size: 2rem;">🛑</span>
        <h2 style="font-size: 1.65rem; font-weight: 800; color: var(--danger);">1. What Problem Are We Trying to Solve?</h2>
      </div>
      <p style="font-size: 1rem; line-height: 1.7; color: var(--text-main); margin-bottom: 1.25rem;">
        Every semester, colleges and universities encounter recurring operational crises during midterms, lab finals, and campus placement evaluations:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--danger);">The Peak Concurrency Crash</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            Traditional learning management systems (LMS) and web forms freeze or throw 500 errors when 200+ students click "Submit" simultaneously in the final minute.
          </p>
        </div>
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--danger);">Faculty Authoring Exhaustion</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            Professors create exam papers in Microsoft Word or LaTeX, then waste hours copying and pasting each question, option A, B, C, D into tedious web form inputs.
          </p>
        </div>
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--danger);">Academic Cheating & Malpractice</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            Without active blur detection, unmonitored browser tabs invite answer sharing and search engines, undermining student integrity and evaluation equity.
          </p>
        </div>
      </div>
    </div>

    <!-- The Solution Given by Us -->
    <div class="card" style="padding: 2.5rem; margin-bottom: 2.5rem; border-left: 6px solid var(--success);">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
        <span style="font-size: 2rem;">✅</span>
        <h2 style="font-size: 1.65rem; font-weight: 800; color: var(--success);">2. The Solution Given by ExamFlow</h2>
      </div>
      <p style="font-size: 1rem; line-height: 1.7; color: var(--text-main); margin-bottom: 1.25rem;">
        ExamFlow reimagines testing from first principles. Rather than patching old web scripts, we designed a high-throughput, self-contained assessment engine:
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--success);">Engineered for 1,000+ Concurrent Students</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            PostgreSQL 16 connection multiplexing and token-based rate limiting allow thousands of test-takers on campus subnets to sync answers with sub-millisecond overhead.
          </p>
        </div>
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--success);">AI & Heuristic Document Extractor</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            Upload complete PDF or Word DOCX question papers. The extractor recognizes questions, options, correct answers, marks, and explanations in 5 seconds flat.
          </p>
        </div>
        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--success);">Fair, Transparent & Audited</h4>
          <p class="text-sm text-muted" style="line-height: 1.6;">
            Real-time anti-cheat monitoring logs focus shifts, server-side locks prevent timer spoofing, and automatic gradebooks export instant CSV reports.
          </p>
        </div>
      </div>
    </div>

    <!-- Architectural Values -->
    <div class="card" style="padding: 2.5rem; margin-bottom: 4rem;">
      <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem;">Engineering Principles</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
        <div>
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 0.25rem;">⚡ Zero Framework Bloat</div>
          <p class="text-sm text-muted">The client is written in pure vanilla JavaScript & CSS. No megabytes of heavy bundles; it boots instantly on any student device.</p>
        </div>
        <div>
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 0.25rem;">🔒 Complete Data Isolation</div>
          <p class="text-sm text-muted">PostgreSQL row-level locking (FOR UPDATE OF attempts) ensures atomic transactions and zero grade tampering during concurrent finishes.</p>
        </div>
        <div>
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 0.25rem;">🏛️ Institutional RBAC</div>
          <p class="text-sm text-muted">Distinct, synchronized roles for Administrators, Faculty Educators, and Enrolled Students with tailored curriculum dashboards.</p>
        </div>
      </div>
    </div>
  `);
}

// ---------- USER PROFILE PAGE ----------
async function renderProfilePage() {
  let meData = null;
  try {
    meData = await api('/auth/me');
  } catch (err) {
    meData = { user: S.user, stats: {} };
  }

  const u = meData.user || S.user;
  const s = meData.stats || {};
  const isFaculty = u.role === 'faculty';
  const isStudent = u.role === 'student';
  const isAdmin = u.role === 'admin';

  app.innerHTML = shell(`
    <div style="max-width: 900px; margin: 0 auto; padding-bottom: 3rem;">
      <!-- Profile Hero Banner -->
      <div class="profile-hero">
        <div class="flex items-center gap-4">
          <div class="profile-avatar">
            ${isAdmin ? '👑' : (isFaculty ? '👨‍🏫' : '🎓')}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.75rem; font-weight: 800;">${esc(u.name)}</h2>
              <span class="user-role-pill role-${u.role}" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4);">
                ${u.role.toUpperCase()}
              </span>
              ${u.auth_provider === 'google' ? `
                <span class="badge" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4);">
                  ✓ Google Account
                </span>
              ` : ''}
            </div>
            <div style="color: rgba(255, 255, 255, 0.8); font-size: 0.92rem; margin-top: 4px;">
              ${esc(u.email)} ${u.department ? `• ${esc(u.department)}` : ''}
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <a href="#/dashboard" class="btn btn-sm btn-outline" style="background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.4);">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      <!-- Live Role Stats -->
      <div class="stats-grid mb-4">
        ${isStudent ? `
          <div class="stat-card">
            <span class="stat-label">Enrolled Courses</span>
            <span class="stat-value">${s.enrolled_courses ?? 0}</span>
            <span class="stat-footer">Active curriculum</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Exams Completed</span>
            <span class="stat-value" style="color: var(--primary);">${s.completed_exams ?? 0}</span>
            <span class="stat-footer">Submitted evaluations</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Average Score</span>
            <span class="stat-value" style="color: var(--success);">${s.avg_score ?? 0}</span>
            <span class="stat-footer">Overall performance</span>
          </div>
        ` : (isFaculty ? `
          <div class="stat-card">
            <span class="stat-label">Courses Managed</span>
            <span class="stat-value">${s.courses_count ?? 0}</span>
            <span class="stat-footer">Academic curriculum</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Exams Authored</span>
            <span class="stat-value" style="color: var(--primary);">${s.tests_count ?? 0}</span>
            <span class="stat-footer">Active assessments</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Questions in Bank</span>
            <span class="stat-value" style="color: var(--success);">${s.questions_count ?? 0}</span>
            <span class="stat-footer">Validated items</span>
          </div>
        ` : `
          <div class="stat-card">
            <span class="stat-label">Total Users</span>
            <span class="stat-value">${s.total_users ?? 0}</span>
            <span class="stat-footer">Institutional profiles</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Courses</span>
            <span class="stat-value" style="color: var(--primary);">${s.total_courses ?? 0}</span>
            <span class="stat-footer">Active catalog</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Examinations</span>
            <span class="stat-value" style="color: var(--success);">${s.total_tests ?? 0}</span>
            <span class="stat-footer">Platform assessments</span>
          </div>
        `)}
      </div>

      <!-- Edit Profile Card -->
      <div class="card" style="padding: 2rem;">
        <div class="card-header" style="margin-bottom: 1.5rem;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800;">Academic Profile Details</h3>
            <p class="text-sm text-muted">Update your institutional identity details and contact information</p>
          </div>
        </div>

        <form data-f="update-profile">
          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label" style="font-weight: 600;">Full Name</label>
              <input type="text" name="name" class="form-control" value="${esc(u.name || '')}" required>
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label" style="font-weight: 600;">Account Email</label>
              <input type="email" class="form-control" value="${esc(u.email || '')}" disabled style="background: var(--surface-subtle); cursor: not-allowed;">
              <span class="text-xs text-muted">Email cannot be modified directly. Contact Admin for changes.</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label" style="font-weight: 600;">Department / Branch</label>
              <input type="text" name="department" class="form-control" value="${esc(u.department || '')}" placeholder="e.g. Computer Science & Engineering">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label" style="font-weight: 600;">Contact Phone</label>
              <input type="tel" name="phone" class="form-control" value="${esc(u.phone || '')}" placeholder="+91 9876543210">
            </div>
          </div>

          ${isStudent ? `
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Roll Number / Student ID</label>
                <input type="text" name="roll_number" class="form-control" value="${esc(u.roll_number || '')}" placeholder="e.g. 2451-22-733-045">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Year / Semester</label>
                <input type="text" name="year_sem" class="form-control" value="${esc(u.year_sem || '')}" placeholder="e.g. 3rd Year - Sem 1">
              </div>
            </div>
          ` : ''}

          ${isFaculty ? `
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Employee Code / Faculty ID</label>
                <input type="text" name="employee_id" class="form-control" value="${esc(u.employee_id || '')}" placeholder="e.g. FAC-CSE-204">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Academic Designation</label>
                <input type="text" name="designation" class="form-control" value="${esc(u.designation || '')}" placeholder="e.g. Associate Professor">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Specialization / Primary Subject</label>
              <input type="text" name="specialization" class="form-control" value="${esc(u.specialization || '')}" placeholder="e.g. Distributed Systems & Algorithms">
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.75rem; font-weight: 700;">
              💾 Save Profile Details
            </button>
          </div>
        </form>
      </div>
    </div>
  `);
}

// ---------- AUTH VIEWS ----------
function renderLogin() {
  app.innerHTML = shell(`
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="brand-icon" style="margin: 0 auto 1rem; width: 48px; height: 48px; font-size: 1.5rem;">⚡</div>
          <h2>Institutional Sign In</h2>
          <p class="text-muted text-sm mt-4">Sign in to your ExamFlow profile</p>
        </div>

        <button type="button" class="google-btn" data-a="open-google-auth" data-role="student" style="margin-bottom: 1.25rem;">
          ${googleSvgIcon()}
          Continue with Google
        </button>

        <div style="position: relative; text-align: center; margin: 1.25rem 0;">
          <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border);"></div>
          <span style="position: relative; background: var(--surface); padding: 0 0.75rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OR SIGN IN WITH EMAIL</span>
        </div>

        <form data-f="login">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" name="email" class="form-control" placeholder="name@college.edu" required autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-control" placeholder="••••••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem; font-weight: 700;">Sign In</button>
        </form>

        <div class="auth-switch">
          Don't have an account yet? <a href="#/register">Register as Student or Faculty</a>
        </div>
      </div>
    </div>
  `);
}

function renderRegister(activeRole = 'student') {
  app.innerHTML = shell(`
    <div class="auth-wrapper" style="padding: 2.5rem 1.5rem;">
      <div class="auth-card" style="max-width: 600px;">
        <div class="auth-header">
          <div class="brand-icon" style="margin: 0 auto 1rem; width: 48px; height: 48px; font-size: 1.5rem;">⚡</div>
          <h2>Create Your Account</h2>
          <p class="text-muted text-sm mt-4">Register as a Student or Faculty member</p>
        </div>

        <div class="role-tabs">
          <button type="button" class="role-tab-btn ${activeRole === 'student' ? 'active' : ''}" id="tab-btn-student" data-a="switch-reg-tab" data-role="student">
            🎓 Student
          </button>
          <button type="button" class="role-tab-btn ${activeRole === 'faculty' ? 'active' : ''}" id="tab-btn-faculty" data-a="switch-reg-tab" data-role="faculty">
            👨‍🏫 Faculty
          </button>
        </div>

        <!-- Student Registration -->
        <div id="reg-box-student" style="${activeRole === 'student' ? 'display:block;' : 'display:none;'}">
          <button type="button" class="google-btn" data-a="open-google-auth" data-role="student" style="margin-bottom: 1.25rem;">
            ${googleSvgIcon()}
            Continue with Google as Student
          </button>

          <div style="position: relative; text-align: center; margin: 1.25rem 0;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border);"></div>
            <span style="position: relative; background: var(--surface); padding: 0 0.75rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OR REGISTER MANUALLY</span>
          </div>

          <form data-f="register">
            <input type="hidden" name="role" value="student">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Full Name *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. John Doe" required autofocus>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">College Email *</label>
                <input type="email" name="email" class="form-control" placeholder="john.doe@college.edu" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Roll Number / Student ID *</label>
                <input type="text" name="roll_number" class="form-control" placeholder="e.g. 2451-22-733-045" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Department *</label>
                <select name="department" class="form-control" required style="font-weight: 600;">
                  <option value="">Select Branch...</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Artificial Intelligence & ML">AI & Machine Learning</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical Engineering">Electrical & Electronics</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Year / Semester *</label>
                <select name="year_sem" class="form-control" required style="font-weight: 600;">
                  <option value="1st Year - Sem 1">1st Year - Sem 1</option>
                  <option value="2nd Year - Sem 1">2nd Year - Sem 1</option>
                  <option value="3rd Year - Sem 1" selected>3rd Year - Sem 1</option>
                  <option value="4th Year - Sem 1">4th Year - Sem 1</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Phone Number</label>
                <input type="tel" name="phone" class="form-control" placeholder="+91 9876543210">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 600;">Password (8+ characters) *</label>
              <input type="password" name="password" class="form-control" placeholder="••••••••••••" minlength="8" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem; font-weight: 700; padding: 0.85rem;">
              🎓 Register Student Account & Start Exams
            </button>
          </form>
        </div>

        <!-- Faculty Registration -->
        <div id="reg-box-faculty" style="${activeRole === 'faculty' ? 'display:block;' : 'display:none;'}">
          <button type="button" class="google-btn" data-a="open-google-auth" data-role="faculty" style="margin-bottom: 1.25rem;">
            ${googleSvgIcon()}
            Continue with Google as Faculty
          </button>

          <div style="position: relative; text-align: center; margin: 1.25rem 0;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border);"></div>
            <span style="position: relative; background: var(--surface); padding: 0 0.75rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OR REGISTER WITH ACADEMIC DETAILS</span>
          </div>

          <form data-f="register">
            <input type="hidden" name="role" value="faculty">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Full Name & Title *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Dr. K. S. Rao" required autofocus>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Institutional Email *</label>
                <input type="email" name="email" class="form-control" placeholder="ksrao@mvsrec.edu.in" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Faculty / Employee ID *</label>
                <input type="text" name="employee_id" class="form-control" placeholder="e.g. FAC-CSE-204" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Department *</label>
                <select name="department" class="form-control" required style="font-weight: 600;">
                  <option value="">Select Academic Department...</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Artificial Intelligence & ML">AI & Machine Learning</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical Engineering">Electrical & Electronics</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Designation *</label>
                <select name="designation" class="form-control" required style="font-weight: 600;">
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor" selected>Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Professor & Head of Department">Professor & HOD</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Primary Subject</label>
                <input type="text" name="specialization" class="form-control" placeholder="e.g. Data Structures & Algorithms">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Phone Number</label>
                <input type="tel" name="phone" class="form-control" placeholder="+91 9876543210">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 600;">Password (8+ chars) *</label>
                <input type="password" name="password" class="form-control" placeholder="••••••••••••" minlength="8" required>
              </div>
            </div>

            <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 0.5rem; font-weight: 700; padding: 0.85rem;">
              👨‍🏫 Register Faculty Account & Launch Studio
            </button>
          </form>
        </div>

        <div class="auth-switch">
          Already registered? <a href="#/login">Sign In here</a>
        </div>
      </div>
    </div>
  `);
}

// ---------- PUBLIC SHARE LINK / JOIN PAGE ----------
async function renderJoinPage(code) {
  let testInfo = null;
  try {
    testInfo = await api(`/tests/join/${code}`);
  } catch (err) {
    app.innerHTML = shell(`
      <div class="auth-wrapper">
        <div class="auth-card text-center">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🚫</div>
          <h3>Exam Link Invalid</h3>
          <p class="text-muted mt-4">This test link does not exist, has expired, or is not yet published.</p>
          <a href="#/" class="btn btn-primary mt-4">Go to Home</a>
        </div>
      </div>
    `);
    return;
  }

  const theme = getCourseTheme(testInfo.course_code, testInfo.course_name);
  const startFormatted = new Date(testInfo.start_at).toLocaleString();
  const endFormatted = new Date(testInfo.end_at).toLocaleString();

  app.innerHTML = shell(`
    <div class="auth-wrapper">
      <div class="auth-card ${theme.themeClass}" style="max-width: 500px; border-top: 4px solid ${theme.color};">
        <div class="auth-header">
          <span class="badge" style="background: ${theme.lightColor}; color: ${theme.color}; margin-bottom: 0.75rem;">
            ${theme.icon} ${esc(testInfo.course_code)} • ${theme.tag}
          </span>
          <h2 style="font-size: 1.4rem;">${esc(testInfo.title)}</h2>
          <p class="text-muted text-sm">${esc(testInfo.course_name)}</p>
        </div>

        <div style="background: var(--surface-subtle); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.88rem; border: 1px solid var(--border);">
          <div class="flex justify-between mb-4">
            <span class="text-muted">Duration:</span>
            <strong>⏱ ${testInfo.duration_min} minutes</strong>
          </div>
          <div class="flex justify-between mb-4">
            <span class="text-muted">Passing Marks Required:</span>
            <strong>${testInfo.pass_marks} marks</strong>
          </div>
          <div class="flex justify-between mb-4">
            <span class="text-muted">Start Window:</span>
            <span>${startFormatted}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Submission Deadline:</span>
            <span>${endFormatted}</span>
          </div>
        </div>

        ${S.user ? `
          <div class="text-center">
            <p class="text-sm text-muted mb-4">Signed in as <strong>${esc(S.user.name)}</strong> (${esc(S.user.role)})</p>
            ${S.user.role === 'student' ? `
              <button class="btn btn-primary" style="width: 100%;" data-a="enroll-and-start" data-code="${code}">
                Enroll & Proceed to Exam →
              </button>
            ` : `
              <div class="badge badge-warning">Only student accounts can take tests. Switch account to take test.</div>
            `}
          </div>
        ` : `
          <div>
            <div style="margin-bottom: 1rem; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
              Fast Access: Register or Login
            </div>
            <form data-f="join-register" data-code="${code}">
              <div class="form-group">
                <input type="text" name="name" class="form-control" placeholder="Your Full Name" required>
              </div>
              <div class="form-group">
                <input type="email" name="email" class="form-control" placeholder="Your College Email" required>
              </div>
              <div class="form-group">
                <input type="password" name="password" class="form-control" placeholder="Password (10+ characters)" minlength="10" required>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                Instant Register & Join Exam
              </button>
            </form>
            <div class="auth-switch">
              Already registered? <a href="#/" onclick="sessionStorage.setItem('join_code', '${code}')">Sign In with existing account</a>
            </div>
          </div>
        `}
      </div>
    </div>
  `);
}

// ---------- ADMIN VIEW ----------
async function renderAdmin() {
  const [users, courses, tests] = await Promise.all([
    api('/users'),
    api('/courses'),
    api('/tests')
  ]);

  const tabs = [
    { label: '📊 Overview & Stats', icon: '⚡' },
    { label: '👥 User Directory & Permissions', icon: '👤' },
    { label: '📚 Course Allocations & Rosters', icon: '📖' },
    { label: '🎯 All Institution Exams', icon: '📝' }
  ];

  const facultyCount = users.filter(u => u.role === 'faculty').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  let tabContent = '';

  if (activeTab === 0) {
    tabContent = `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Students</span>
          <span class="stat-value">${studentCount}</span>
          <span class="stat-footer">Enrolled exam candidates</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Faculty Staff</span>
          <span class="stat-value">${facultyCount}</span>
          <span class="stat-footer">Course mentors & authors</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Curriculum Courses</span>
          <span class="stat-value">${courses.length}</span>
          <span class="stat-footer">Active academic subjects</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Assessments Created</span>
          <span class="stat-value">${tests.length}</span>
          <span class="stat-footer">Total tests scheduled</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Quick Action: Add User</div>
            <div class="card-subtitle">Create a verified administrator, faculty member, or student</div>
          </div>
        </div>
        <form data-f="mkuser" class="form-row">
          <div>
            <label class="form-label">Full Name</label>
            <input type="text" name="name" class="form-control" placeholder="Dr. Sriman Rao" required>
          </div>
          <div>
            <label class="form-label">Email Address</label>
            <input type="email" name="email" class="form-control" placeholder="sriman@mvsrec.edu.in" required>
          </div>
          <div>
            <label class="form-label">Password (Min 10 chars)</label>
            <input type="password" name="password" class="form-control" placeholder="StrongSecret123" minlength="10" required>
          </div>
          <div>
            <label class="form-label">Role</label>
            <select name="role" class="form-control">
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button type="submit" class="btn btn-primary" style="width: 100%;">Create Account</button>
          </div>
        </form>
      </div>
    `;
  } else if (activeTab === 1) {
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">User Directory (${users.length})</div>
            <div class="card-subtitle">Edit profile details, reset passwords, change roles, or delete users</div>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><code>#${u.id}</code></td>
                  <td><strong>${esc(u.name)}</strong></td>
                  <td>${esc(u.email)}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'faculty' ? 'badge-warning' : 'badge-info'}">${u.role}</span></td>
                  <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-sm btn-outline" data-a="edit-user-modal" data-user='${JSON.stringify(u)}'>
                        ✏️ Edit
                      </button>
                      <button class="btn btn-sm ${u.status === 'active' ? 'btn-warning' : 'btn-success'}" 
                        data-a="toggle-user" data-id="${u.id}" data-status="${u.status === 'active' ? 'inactive' : 'active'}">
                        ${u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button class="btn btn-sm btn-danger" data-a="delete-user" data-id="${u.id}" data-name="${esc(u.name)}">
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 2) {
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Create Curriculum Course</div>
            <div class="card-subtitle">Create a subject and assign an instructor</div>
          </div>
        </div>
        <form data-f="mkcourse" class="form-row">
          <div>
            <label class="form-label">Course Code</label>
            <input type="text" name="code" class="form-control" placeholder="CS304" required>
          </div>
          <div>
            <label class="form-label">Course Title</label>
            <input type="text" name="name" class="form-control" placeholder="Distributed Operating Systems" required>
          </div>
          <div>
            <label class="form-label">Assigned Faculty</label>
            <select name="faculty_id" class="form-control" required>
              <option value="">Select Faculty...</option>
              ${users.filter(u => u.role === 'faculty').map(f => `
                <option value="${f.id}">${esc(f.name)} (${esc(f.email)})</option>
              `).join('')}
            </select>
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button type="submit" class="btn btn-primary" style="width: 100%;">Create Course</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Batch Student Enrollment</div>
            <div class="card-subtitle">Assign students to a course by their User IDs</div>
          </div>
        </div>
        <form data-f="enroll" class="form-row">
          <div>
            <label class="form-label">Target Course</label>
            <select name="course_id" class="form-control" required>
              <option value="">Select Course...</option>
              ${courses.map(c => `
                <option value="${c.id}">${esc(c.code)} - ${esc(c.name)}</option>
              `).join('')}
            </select>
          </div>
          <div style="grid-column: span 2;">
            <label class="form-label">Student IDs (Comma Separated)</label>
            <input type="text" name="student_ids" class="form-control" placeholder="e.g. 2, 4, 7, 9" required>
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button type="submit" class="btn btn-primary" style="width: 100%;">Enroll Batch</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Active Courses (${courses.length})</div>
          <span class="text-sm text-muted">Synchronized across Admin and Faculty</span>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Course</th>
                <th>Track</th>
                <th>Instructor</th>
                <th>Students</th>
                <th>Tests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${courses.map(c => {
                const theme = getCourseTheme(c.code, c.name);
                return `
                  <tr>
                    <td><code>#${c.id}</code></td>
                    <td>
                      <span class="badge" style="background: ${theme.lightColor}; color: ${theme.color}; margin-right: 0.4rem;">${theme.icon} ${esc(c.code)}</span>
                      <strong>${esc(c.name)}</strong>
                    </td>
                    <td><span class="text-sm text-muted">${theme.tag}</span></td>
                    <td>${c.faculty_name ? `<strong>${esc(c.faculty_name)}</strong> <div class="text-sm text-muted">${esc(c.faculty_email)}</div>` : '<span class="text-muted">Unassigned</span>'}</td>
                    <td><span class="badge badge-info">${c.students_count || 0} enrolled</span></td>
                    <td><span class="badge badge-primary">${c.tests_count || 0} tests</span></td>
                    <td>
                      <div class="flex gap-2">
                        <button class="btn btn-sm btn-outline" data-a="edit-course-modal" data-course='${JSON.stringify(c)}'>
                          ✏️ Edit
                        </button>
                        <button class="btn btn-sm btn-danger" data-a="delete-course" data-id="${c.id}" data-name="${esc(c.name)}">
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 3) {
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">All Examinations in Institution (${tests.length})</div>
            <div class="card-subtitle">Administrators have full privileges to edit, publish, or remove any test</div>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Title & Course</th>
                <th>Schedule</th>
                <th>Duration & Pass</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tests.map(t => {
                const theme = getCourseTheme(t.course_code, t.course_name);
                return `
                  <tr>
                    <td>
                      <span class="badge" style="background: ${theme.lightColor}; color: ${theme.color}; margin-right: 0.35rem;">${theme.icon} ${esc(t.course_code)}</span>
                      <strong>${esc(t.title)}</strong>
                      <div class="text-sm text-muted">${esc(t.course_name)}</div>
                    </td>
                    <td>
                      <div class="text-sm">${new Date(t.start_at).toLocaleDateString()} ${new Date(t.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      <div class="text-sm text-muted">to ${new Date(t.end_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td>${t.duration_min}m • Pass: ${t.pass_marks}m</td>
                    <td>
                      <span class="badge ${t.published ? 'badge-success' : 'badge-warning'}">${t.published ? 'Published' : 'Draft'}</span>
                    </td>
                    <td><span class="badge badge-info">${t.attempts_count || 0} / ${t.enrolled_count || 0}</span></td>
                    <td>
                      <div class="flex gap-2">
                        <button class="btn btn-sm btn-outline" data-a="edit-test-modal" data-test='${JSON.stringify(t)}'>
                          ✏️ Edit
                        </button>
                        <button class="btn btn-sm btn-primary" data-a="get-share" data-id="${t.id}">
                          🔗 Link
                        </button>
                        <button class="btn btn-sm btn-danger" data-a="delete-test" data-id="${t.id}" data-title="${esc(t.title)}">
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  app.innerHTML = shell(`
    <div class="tabs-nav">
      ${tabs.map((t, idx) => `
        <button class="tab-btn ${activeTab === idx ? 'active' : ''}" data-a="set-tab" data-tab="${idx}">
          ${t.icon} ${t.label}
        </button>
      `).join('')}
    </div>
    ${tabContent}
  `);
}

// ---------- FACULTY VIEW ----------
async function renderFaculty() {
  const courses = await api('/courses');
  if (!F.course && courses.length > 0) {
    const myCourse = (S.user && S.user.role === 'faculty') ? courses.find(c => c.faculty_id === S.user.id) : null;
    F.course = myCourse ? myCourse.id : courses[0].id;
  }
  
  if (F.course) {
    F.qs = await api(`/questions?course_id=${F.course}`);
  } else {
    F.qs = [];
  }
  const tests = await api('/tests');

  if (F.selectedQs.size === 0 && F.qs.length > 0) {
    F.qs.forEach(q => F.selectedQs.add(q.id));
  }

  const tabs = [
    { label: '🎯 Exam Creator & Question Selection', icon: '⚡' },
    { label: '📝 Question Bank & Extractor', icon: '❓' },
    { label: '📈 Evaluation & Results', icon: '📊' }
  ];

  const now = new Date();
  const nowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const end = new Date(now.getTime() + 4 * 3600000);
  const endStr = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  let tabContent = '';

  if (activeTab === 0) {
    const selectedCount = F.selectedQs.size;
    const totalMarks = F.qs.filter(q => F.selectedQs.has(q.id)).reduce((acc, q) => acc + (+q.marks || 1), 0);
    const curCourse = courses.find(c => c.id == F.course);
    const curTheme = curCourse ? getCourseTheme(curCourse.code, curCourse.name) : getCourseTheme();

    tabContent = `
      <!-- Active Course Switcher with Theming -->
      <div class="card ${curTheme.themeClass}" style="padding: 1rem 1.5rem; margin-bottom: 1.25rem;">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${curTheme.icon}</span>
              <span>Active Curriculum Course</span>
              <span class="badge" style="background: ${curTheme.lightColor}; color: ${curTheme.color}; font-size: 0.72rem;">${curTheme.tag}</span>
            </div>
            <div class="text-sm text-muted">All courses in the institution curriculum are synchronized here:</div>
          </div>
          <div>
            <select class="form-control" data-c style="min-width: 320px; font-weight: 600;">
              ${courses.map(c => {
                const th = getCourseTheme(c.code, c.name);
                return `
                  <option value="${c.id}" ${c.id == F.course ? 'selected' : ''}>
                    ${th.icon} ${esc(c.code)} - ${esc(c.name)}
                  </option>
                `;
              }).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Test Creation Form with INLINE Question Selection -->
      <div class="card" style="border: 2px solid ${curTheme.color}33;">
        <div class="card-header">
          <div>
            <div class="card-title">🎯 Create & Schedule New Examination</div>
            <div class="card-subtitle">Configure test parameters and tick questions on this single screen</div>
          </div>
          <div id="selection-summary-badge" class="badge ${selectedCount > 0 ? 'badge-success' : 'badge-warning'}" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">
            ✓ ${selectedCount} Question(s) Selected (${totalMarks} Marks)
          </div>
        </div>

        <form data-f="mktest">
          <div class="form-row" style="margin-bottom: 1.5rem;">
            <div style="grid-column: span 2;">
              <label class="form-label">Exam Title *</label>
              <input type="text" name="title" class="form-control" placeholder="e.g. Unit Test - Algorithms & Graphs" required>
            </div>
            <div>
              <label class="form-label">Duration (Minutes) *</label>
              <input type="number" name="duration_min" class="form-control" value="60" min="1" required>
            </div>
            <div>
              <label class="form-label">Passing Marks Required</label>
              <input type="number" name="pass_marks" class="form-control" value="40" min="0" required>
            </div>
            <div>
              <label class="form-label">Start Time Window *</label>
              <input type="datetime-local" name="start_at" class="form-control" value="${nowStr}" required>
            </div>
            <div>
              <label class="form-label">End Time Window *</label>
              <input type="datetime-local" name="end_at" class="form-control" value="${endStr}" required>
            </div>
          </div>

          <!-- Question Picker Header & Controls -->
          <div style="background: var(--surface-subtle); padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--border);">
            <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <strong style="font-size: 0.95rem;">Select Questions for this Test (${F.qs.length} Available)</strong>
                <div class="text-sm text-muted">Tick the questions to include in this examination:</div>
              </div>
              <div class="flex gap-2">
                <button type="button" class="btn btn-sm btn-outline" data-a="select-all-qs">✓ Select All</button>
                <button type="button" class="btn btn-sm btn-outline" data-a="clear-all-qs">✕ Clear Selection</button>
                <button type="button" class="btn btn-sm btn-primary" data-a="set-tab" data-tab="1">➕ Add / Parse Questions</button>
              </div>
            </div>
          </div>

          <!-- Questions Selection List -->
          <div id="questions-picker-list" style="max-height: 380px; overflow-y: auto; padding: 0.25rem; margin-bottom: 1.5rem;">
            ${F.qs.length ? F.qs.map((q, idx) => {
              const isChecked = F.selectedQs.has(q.id);
              return `
                <label class="opt-card ${isChecked ? 'selected' : ''}" style="margin-bottom: 0.65rem; padding: 0.85rem 1.15rem; cursor: pointer;">
                  <input type="checkbox" class="qsel" value="${q.id}" ${isChecked ? 'checked' : ''} data-a="toggle-qsel" style="transform: scale(1.2); margin-right: 0.75rem;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem;">Q${idx + 1}. ${esc(q.text)}</div>
                    <div class="text-sm text-muted" style="margin-top: 4px; display: flex; gap: 0.5rem; align-items: center;">
                      <span class="badge badge-info">${q.type}</span>
                      <span class="badge badge-success">+${q.marks} Mark(s)</span>
                      ${q.options && q.options.length ? `<span>• ${q.options.length} options</span>` : ''}
                    </div>
                  </div>
                </label>
              `;
            }).join('') : `
              <div style="text-align: center; padding: 2.5rem; background: var(--surface-subtle); border-radius: var(--radius-md);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📝</div>
                <h4>No Questions in this Course Question Bank Yet</h4>
                <p class="text-sm text-muted mt-4">Add questions using the Question Bank tab first, then pick them here.</p>
                <button type="button" class="btn btn-primary mt-4" data-a="set-tab" data-tab="1">
                  ⚡ Go to Question Extractor
                </button>
              </div>
            `}
          </div>

          <button type="submit" class="btn btn-primary" id="btn-create-test" style="width: 100%; padding: 0.85rem; font-size: 1rem;" ${F.qs.length === 0 ? 'disabled' : ''}>
            🚀 Create & Publish Assessment (${selectedCount} Questions Selected)
          </button>
        </form>
      </div>

      <!-- Tests Table with Edit & Delete Permissions -->
      <div class="card" style="margin-top: 2rem;">
        <div class="card-header">
          <div>
            <div class="card-title">Manage Examinations & Shareable Links (${tests.length})</div>
            <div class="card-subtitle">Distribute test links, modify settings, view enrolled students, or delete tests</div>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Test Title & Course</th>
                <th>Schedule</th>
                <th>Duration & Pass</th>
                <th>Status</th>
                <th>Assigned Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tests.map(t => {
                const isPub = t.published;
                const isRel = t.results_released;
                const th = getCourseTheme(t.course_code, t.course_name);
                return `
                  <tr>
                    <td>
                      <span class="badge" style="background: ${th.lightColor}; color: ${th.color}; margin-right: 0.35rem;">${th.icon} ${esc(t.course_code)}</span>
                      <strong>${esc(t.title)}</strong>
                      <div class="text-sm text-muted">${esc(t.course_name)} ${t.share_code ? `• Code: <code>${t.share_code}</code>` : ''}</div>
                    </td>
                    <td>
                      <div class="text-sm">${new Date(t.start_at).toLocaleDateString()} ${new Date(t.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      <div class="text-sm text-muted">to ${new Date(t.end_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td>${t.duration_min}m • Pass: ${t.pass_marks}m</td>
                    <td>
                      <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Draft'}</span>
                      <span class="badge ${isRel ? 'badge-info' : 'badge-muted'}">${isRel ? 'Results Out' : 'Pending'}</span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline" data-a="view-students" data-id="${t.id}">
                        👥 View (${t.enrolled_count || 0})
                      </button>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button class="btn btn-sm ${isPub ? 'btn-warning' : 'btn-success'}" data-a="pub" data-id="${t.id}" data-v="${!isPub}">
                          ${isPub ? 'Unpublish' : 'Publish'}
                        </button>
                        <button class="btn btn-sm btn-primary" data-a="get-share" data-id="${t.id}">
                          🔗 Share
                        </button>
                        <button class="btn btn-sm btn-outline" data-a="edit-test-modal" data-test='${JSON.stringify(t)}'>
                          ✏️ Edit
                        </button>
                        <button class="btn btn-sm ${isRel ? 'btn-outline' : 'btn-info'}" data-a="rel" data-id="${t.id}" data-v="${!isRel}">
                          ${isRel ? 'Hide Results' : 'Release'}
                        </button>
                        <button class="btn btn-sm btn-danger" data-a="delete-test" data-id="${t.id}" data-title="${esc(t.title)}">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 1) {
    // Tab 1: Question Bank & Smart Extractor
    const curCourse = courses.find(c => c.id == F.course);
    const curTheme = curCourse ? getCourseTheme(curCourse.code, curCourse.name) : getCourseTheme();
    tabContent = `
      <div class="card ${curTheme.themeClass}">
        <div class="card-header">
          <div>
            <div class="card-title">
              <span>${curTheme.icon}</span> Course Curriculum Question Bank
            </div>
            <div class="card-subtitle">Extract questions from pasted text or edit existing questions</div>
          </div>
          <div>
            <select class="form-control" data-c style="min-width: 280px; font-weight: 600;">
              ${courses.map(c => `
                <option value="${c.id}" ${c.id == F.course ? 'selected' : ''}>
                  ${esc(c.code)} - ${esc(c.name)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="background: var(--surface); padding: 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
                ⚡ Smart Question Extractor (PDF / DOCX / Text)
              </h3>
              <p class="text-sm text-muted" style="margin-top: 4px;">
                Upload examination question papers in <strong>PDF</strong>, <strong>Word (.docx)</strong>, or <strong>Text</strong> format. Our parser auto-extracts questions, options, answer keys, marks & explanations.
              </p>
            </div>
          </div>

          <!-- Drag & Drop Upload Zone -->
          <div class="upload-dropzone" id="extractor-dropzone" data-a="dropzone-click">
            <input type="file" id="extractor-file-input" accept=".pdf,.docx,.doc,.txt" style="display:none">
            <div style="font-size: 2.25rem; line-height: 1; margin-bottom: 0.75rem;">📁</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.25rem; color: var(--text-main);">
              Drag & Drop your Question Document here
            </div>
            <div class="text-sm text-muted" style="margin-bottom: 0.85rem;">
              or click anywhere in this box to browse from your device
            </div>
            <div style="display: flex; justify-content: center; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-sm btn-primary" id="browse-doc-btn" data-a="browse-doc">
                📂 Choose PDF / DOCX / TXT File
              </button>
            </div>
            <div class="file-badge-group">
              <span class="file-type-pill pill-pdf">PDF Document</span>
              <span class="file-type-pill pill-docx">Word (.docx, .doc)</span>
              <span class="file-type-pill pill-txt">Text / Markdown</span>
              <span class="text-xs text-muted" style="font-size: 0.75rem; margin-left: 0.5rem;">Max 20MB</span>
            </div>
          </div>

          <div id="upload-status-box" style="display:none;"></div>

          <!-- Alternative Text Paste Section (Collapsible) -->
          <details style="margin-top: 1.25rem; background: var(--surface-subtle); border-radius: var(--radius-md); border: 1px solid var(--border); padding: 0.75rem 1rem;" id="raw-text-details">
            <summary style="cursor: pointer; font-size: 0.88rem; font-weight: 700; color: var(--text-main); user-select: none;">
              📝 Or Paste / Inspect Raw Document Text
            </summary>
            <div style="margin-top: 0.75rem;">
              <p class="text-xs text-muted" style="font-size: 0.8rem; margin-bottom: 0.5rem;">
                Standard formatted text (e.g. "1. What is RAM? A) Volatile B) Non-volatile Answer: A Marks: 2").
              </p>
              <form data-f="parse">
                <textarea name="text" id="extractor-raw-textarea" rows="6" class="form-control" placeholder="1. What is the time complexity of quicksort in the average case?
A) O(n)
B) O(n log n)
C) O(n^2)
D) O(1)
Answer: B
Marks: 2
Explanation: Quicksort partitions the array recursively in O(n log n) average time."></textarea>
                <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                  <button type="submit" class="btn btn-primary btn-sm">⚡ Parse & Extract from Text</button>
                </div>
              </form>
            </div>
          </details>

          <!-- Draft Questions Review Area -->
          <div id="drafts" style="margin-top: 1.5rem;"></div>
        </div>

        <div class="card-header" style="margin-top: 2rem;">
          <div class="card-title">Stored Questions (${F.qs.length})</div>
          <button class="btn btn-sm btn-primary" data-a="set-tab" data-tab="0">
            🎯 Use in Exam Creator →
          </button>
        </div>
        <div style="max-height: 450px; overflow-y: auto;">
          ${F.qs.length ? F.qs.map((q, idx) => `
            <div class="opt-card" style="margin-bottom: 0.65rem; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div><strong>Q${idx + 1}. ${esc(q.text)}</strong></div>
                <div class="text-sm text-muted" style="margin-top: 4px;">
                  <span class="badge badge-info">${q.type}</span>
                  <span class="badge badge-success">+${q.marks} Mark(s)</span>
                  ${q.options && q.options.length ? `<span>• Options: ${q.options.map(o => esc(o)).join(' | ')}</span>` : ''}
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline" data-a="edit-q-modal" data-q='${JSON.stringify(q)}'>
                  ✏️ Edit
                </button>
                <button class="btn btn-sm btn-danger" data-a="delete-q" data-id="${q.id}">
                  🗑️
                </button>
              </div>
            </div>
          `).join('') : '<p class="text-muted text-center" style="padding: 2rem;">No questions added yet for this course. Use the extractor above!</p>'}
        </div>
      </div>
    `;
  } else if (activeTab === 2) {
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Select Examination for Analytics</div>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <select id="res-test-select" class="form-control" style="max-width: 400px; font-weight: 600;">
            <option value="">Choose Test...</option>
            ${tests.map(t => {
              const th = getCourseTheme(t.course_code, t.course_name);
              return `<option value="${t.id}">${th.icon} ${esc(t.title)} (${esc(t.course_code)})</option>`;
            }).join('')}
          </select>
          <button class="btn btn-primary" data-a="load-analytics">View Report</button>
          <button class="btn btn-outline" data-a="download-csv">Export CSV</button>
        </div>
        <div id="analytics-container">
          <p class="text-muted text-center" style="padding: 3rem;">Select a test above to view score distributions and student rankings.</p>
        </div>
      </div>
    `;
  }

  app.innerHTML = shell(`
    <div class="tabs-nav">
      ${tabs.map((t, idx) => `
        <button class="tab-btn ${activeTab === idx ? 'active' : ''}" data-a="set-tab" data-tab="${idx}">
          ${t.icon} ${t.label}
        </button>
      `).join('')}
    </div>
    ${tabContent}
  `);

  if (activeTab === 1) drawDrafts();
}

function updateQuestionSelectionUI() {
  const badge = document.getElementById('selection-summary-badge');
  const btn = document.getElementById('btn-create-test');
  const totalMarks = F.qs.filter(q => F.selectedQs.has(q.id)).reduce((acc, q) => acc + (+q.marks || 1), 0);
  const count = F.selectedQs.size;

  if (badge) {
    badge.textContent = `✓ ${count} Question(s) Selected (${totalMarks} Marks)`;
    badge.className = `badge ${count > 0 ? 'badge-success' : 'badge-warning'}`;
  }
  if (btn) {
    btn.textContent = `🚀 Create & Publish Assessment (${count} Questions Selected)`;
  }
}

function drawDrafts() {
  const d = document.getElementById('drafts');
  if (!d) return;
  if (!F.drafts || !F.drafts.length) {
    d.innerHTML = '';
    return;
  }

  const readyCount = F.drafts.filter(x => !x.needs_review).length;
  const reviewCount = F.drafts.length - readyCount;

  d.innerHTML = `
    <div style="border-top: 2px dashed var(--border); padding-top: 1.5rem; margin-top: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
            <span>📋 Extracted Draft Questions</span>
            <span class="badge badge-info">${F.drafts.length} total</span>
            <span class="badge badge-success">✓ ${readyCount} ready</span>
            ${reviewCount > 0 ? `<span class="badge badge-warning">⚠ ${reviewCount} need review</span>` : ''}
          </h4>
          <div class="text-sm text-muted">Review, customize, and select questions before saving to this course's Question Bank.</div>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-sm btn-outline" data-a="draft-select-all">Select All</button>
          <button type="button" class="btn btn-sm btn-outline" data-a="draft-deselect-all">Deselect All</button>
          <button type="button" class="btn btn-sm btn-danger" data-a="draft-clear-all">Clear Drafts</button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${F.drafts.map((x, i) => {
          let ansDisplay = '';
          if (x.type === 'true_false') {
            ansDisplay = x.correct && x.correct[0] ? String(x.correct[0]).toUpperCase() : 'True';
          } else if (Array.isArray(x.correct)) {
            ansDisplay = x.correct.map(n => typeof n === 'number' ? String.fromCharCode(65 + n) : String(n).toUpperCase()).join(', ');
          }
          const optionsText = Array.isArray(x.options) ? x.options.join('\n') : '';

          return `
            <div class="draft-card ${x.needs_review ? 'needs-review' : 'ready'}" data-d="${i}">
              <div class="flex justify-between items-center mb-4" style="flex-wrap: wrap; gap: 0.5rem;">
                <div class="flex items-center gap-2">
                  <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">
                    #${i + 1}
                  </span>
                  <span class="badge ${x.needs_review ? 'badge-warning' : 'badge-success'}">
                    ${x.needs_review ? '⚠ Incomplete / Needs Answer' : '✓ Ready to Save'}
                  </span>
                </div>
                <div class="flex items-center gap-4">
                  <label class="text-sm flex items-center gap-2" style="cursor: pointer; font-weight: 600;">
                    <input type="checkbox" class="dsel" ${x.needs_review ? '' : 'checked'} style="transform: scale(1.15);">
                    Include in Bank
                  </label>
                  <button type="button" class="btn btn-sm btn-outline" data-a="draft-remove" data-idx="${i}" title="Remove question" style="padding: 2px 8px; font-size: 0.8rem;">
                    ✕
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Question Text</label>
                <input class="form-control dt" value="${esc(x.text)}" placeholder="Enter question statement...">
              </div>

              <div class="form-row" style="margin-bottom: 0.75rem;">
                <div style="flex: 1;">
                  <label class="form-label" style="font-weight: 600;">Question Type</label>
                  <select class="form-control dtype">
                    <option value="single" ${x.type === 'single' ? 'selected' : ''}>Single Choice (Radio)</option>
                    <option value="multiple" ${x.type === 'multiple' ? 'selected' : ''}>Multiple Choice (Checkboxes)</option>
                    <option value="true_false" ${x.type === 'true_false' ? 'selected' : ''}>True / False</option>
                  </select>
                </div>
                <div style="flex: 1;">
                  <label class="form-label" style="font-weight: 600;">Correct Option(s)</label>
                  <input class="form-control dc" value="${esc(ansDisplay)}" placeholder="e.g. B or A, C or True">
                </div>
                <div style="flex: 0.5; min-width: 100px;">
                  <label class="form-label" style="font-weight: 600;">Marks</label>
                  <input type="number" class="form-control dm" value="${x.marks || 1}" min="1">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Options (One per line)</label>
                <textarea class="form-control do" rows="${Math.max(2, (x.options || []).length || 2)}" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4">${esc(optionsText)}</textarea>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label text-muted" style="font-size: 0.8rem;">Explanation / Solution Key (Optional)</label>
                <input class="form-control de text-sm" value="${esc(x.explanation || '')}" placeholder="Reasoning or reference for this answer...">
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 1.25rem;">
        <button class="btn btn-success" data-a="savedrafts" style="width: 100%; font-size: 1rem; padding: 0.85rem; font-weight: 700; box-shadow: var(--shadow-md);">
          💾 Save Validated Questions to Course Question Bank
        </button>
      </div>
    </div>
  `;
}

async function handleQuestionFileUpload(file) {
  if (!file) return;
  const dropzone = document.getElementById('extractor-dropzone');
  const statusBox = document.getElementById('upload-status-box');
  const fname = file.name || 'document';
  const fsize = (file.size / 1024).toFixed(1);

  if (dropzone) dropzone.classList.add('loading');
  if (statusBox) {
    statusBox.style.display = 'block';
    statusBox.innerHTML = `
      <div class="selected-file-card">
        <div class="flex items-center gap-2">
          <div class="spinner"></div>
          <div>
            <div style="font-weight: 700;">Parsing ${esc(fname)} (${fsize} KB)...</div>
            <div class="text-sm text-muted">Reading document structure and extracting multiple-choice questions & answers...</div>
          </div>
        </div>
      </div>
    `;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await api('/questions/upload', 'POST', formData);
    F.drafts = res.questions || [];

    const rawTextarea = document.getElementById('extractor-raw-textarea');
    if (rawTextarea && res.text) {
      rawTextarea.value = res.text;
    }

    if (statusBox) {
      const readyNum = F.drafts.filter(x => !x.needs_review).length;
      statusBox.innerHTML = `
        <div class="selected-file-card" style="border-left: 4px solid var(--success);">
          <div class="flex items-center gap-2">
            <span style="font-size: 1.35rem;">📄</span>
            <div>
              <div style="font-weight: 700;">${esc(fname)} <span class="text-sm text-muted">(${fsize} KB)</span></div>
              <div class="text-sm" style="color: var(--success); font-weight: 600;">
                ✓ Successfully parsed ${F.drafts.length} questions (${readyNum} ready to save)
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" data-a="clear-uploaded-file">Clear</button>
        </div>
      `;
    }

    drawDrafts();
    toast(`Extracted ${F.drafts.length} question(s) from ${fname}!`);
  } catch (err) {
    if (statusBox) {
      statusBox.innerHTML = `
        <div class="selected-file-card" style="border-left: 4px solid var(--danger);">
          <div class="flex items-center gap-2">
            <span style="font-size: 1.35rem;">❌</span>
            <div>
              <div style="font-weight: 700;">Extraction Error: ${esc(fname)}</div>
              <div class="text-sm" style="color: var(--danger);">${esc(err.message)}</div>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" data-a="clear-uploaded-file">Dismiss</button>
        </div>
      `;
    }
  } finally {
    if (dropzone) dropzone.classList.remove('loading');
  }
}

// ---------- STUDENT VIEW ----------
async function renderStudent() {
  const [tests, myCourses, catalog] = await Promise.all([
    api('/tests'),
    api('/courses'),
    api('/courses/catalog')
  ]);

  const tabs = [
    { label: '📝 Assigned Examinations', icon: '⚡' },
    { label: '📚 My Enrolled Courses & Requirements', icon: '📖' },
    { label: '🏆 Completed & Scorecards', icon: '📊' }
  ];

  let tabContent = '';

  if (activeTab === 0) {
    const activeTests = tests.filter(t => !t.submitted_at);
    tabContent = `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Pending Tests</span>
          <span class="stat-value">${activeTests.length}</span>
          <span class="stat-footer">Ready to attempt</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Enrolled Courses</span>
          <span class="stat-value">${myCourses.length}</span>
          <span class="stat-footer">Active subjects</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Submitted Tests</span>
          <span class="stat-value">${tests.filter(t => t.submitted_at).length}</span>
          <span class="stat-footer">Completed successfully</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Assigned Examinations</div>
            <div class="card-subtitle">Showing tests for your enrolled courses with passing requirements</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
          ${activeTests.length ? activeTests.map(t => {
            const now = new Date();
            const start = new Date(t.start_at);
            const end = new Date(t.end_at);
            const canStart = now >= start && now <= end;
            const th = getCourseTheme(t.course_code, t.course_name);

            return `
              <div class="course-card ${th.themeClass}" style="margin-bottom: 0;">
                <div class="flex justify-between items-center mb-4">
                  <span class="course-badge badge" style="background: ${th.lightColor}; color: ${th.color};">
                    ${th.icon} ${esc(t.course_code)} • ${th.tag}
                  </span>
                  <span class="text-sm font-bold" style="font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">
                    ⏱ ${t.duration_min} Mins
                  </span>
                </div>
                <h3 style="font-size: 1.15rem; margin-bottom: 0.25rem; font-weight: 700;">${esc(t.title)}</h3>
                <div class="text-sm text-muted mb-4">${esc(t.course_name)}</div>
                
                <div style="background: var(--surface-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.15rem; font-size: 0.82rem; border: 1px solid var(--border);">
                  <div class="flex justify-between mb-4">
                    <span class="text-muted">Passing Requirement:</span>
                    <strong style="color: ${th.color};">${t.pass_marks} marks minimum</strong>
                  </div>
                  <div class="flex justify-between mb-4">
                    <span class="text-muted">Start Window:</span>
                    <span>${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (${start.toLocaleDateString()})</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted">Deadline:</span>
                    <span>${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (${end.toLocaleDateString()})</span>
                  </div>
                </div>

                ${canStart ? `
                  <button class="btn btn-primary" style="width: 100%;" data-a="start-exam" data-id="${t.id}">
                    ${t.attempt_id ? '⚡ Resume Examination' : '▶ Start Examination Now'}
                  </button>
                ` : `
                  <button class="btn btn-secondary" style="width: 100%;" disabled>
                    ${now < start ? 'Opens Soon' : 'Exam Window Expired'}
                  </button>
                `}
              </div>
            `;
          }).join('') : '<p class="text-muted text-center" style="padding: 3rem; grid-column: span 2;">No pending tests scheduled. Browse courses below to enroll!</p>'}
        </div>
      </div>
    `;
  } else if (activeTab === 1) {
    // Tab 1: Enrolled Courses & Requirements
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">My Registered Courses (${myCourses.length})</div>
            <div class="card-subtitle">All academic curriculum subjects you are enrolled in</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
          ${myCourses.length ? myCourses.map(c => {
            const th = getCourseTheme(c.code, c.name);
            return `
              <div class="course-card ${th.themeClass}">
                <div class="flex justify-between items-center mb-4">
                  <span class="course-badge badge" style="background: ${th.lightColor}; color: ${th.color};">
                    ${th.icon} ${esc(c.code)}
                  </span>
                  <span class="badge badge-success">✓ Enrolled</span>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem;">${esc(c.name)}</h3>
                <p class="text-sm text-muted mb-4">${th.tag}</p>
                
                <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center;">
                  <div class="text-muted">Instructor: <strong>${c.faculty_name ? esc(c.faculty_name) : 'Department'}</strong></div>
                  <span class="badge badge-primary">${c.tests_count || 0} Tests</span>
                </div>
              </div>
            `;
          }).join('') : '<p class="text-muted text-center" style="padding: 2rem; grid-column: span 2;">You are not enrolled in any courses yet. Select courses from the catalog below!</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Explore Institutional Course Catalog (${catalog.length})</div>
            <div class="card-subtitle">Self-enroll into required academic subjects to unlock scheduled examinations</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
          ${catalog.map(c => {
            const th = getCourseTheme(c.code, c.name);
            return `
              <div class="course-card ${th.themeClass}">
                <div class="flex justify-between items-center mb-4">
                  <span class="course-badge badge" style="background: ${th.lightColor}; color: ${th.color};">
                    ${th.icon} ${esc(c.code)}
                  </span>
                  <span class="badge badge-info">${c.tests_count || 0} Tests</span>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem;">${esc(c.name)}</h3>
                <p class="text-sm text-muted mb-4">${th.tag} • Mentor: ${c.faculty_name ? esc(c.faculty_name) : 'Academic Faculty'}</p>
                
                <div style="margin-top: auto;">
                  ${c.enrolled ? `
                    <button class="btn btn-sm btn-secondary" style="width: 100%; cursor: default;" disabled>
                      ✓ Already Enrolled
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-primary" style="width: 100%;" data-a="self-enroll" data-id="${c.id}">
                      ➕ Enroll in Course
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (activeTab === 2) {
    const completed = tests.filter(t => t.submitted_at);
    tabContent = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Completed Submissions & Official Scorecards</div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Test Title</th>
                <th>Course</th>
                <th>Submission Time</th>
                <th>Status</th>
                <th>Scorecard</th>
              </tr>
            </thead>
            <tbody>
              ${completed.length ? completed.map(t => {
                const th = getCourseTheme(t.course_code, t.course_name);
                return `
                  <tr>
                    <td><strong>${esc(t.title)}</strong></td>
                    <td>
                      <span class="badge" style="background: ${th.lightColor}; color: ${th.color}; margin-right: 0.35rem;">${th.icon} ${esc(t.course_code)}</span>
                      ${esc(t.course_name)}
                    </td>
                    <td>${new Date(t.submitted_at).toLocaleString()}</td>
                    <td><span class="badge badge-success">Submitted</span></td>
                    <td>
                      <button class="btn btn-sm btn-outline" data-a="student-result" data-id="${t.attempt_id}">
                        View Official Result
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">No examinations completed yet.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="student-scorecard" style="margin-top: 1.5rem;"></div>
      </div>
    `;
  }

  app.innerHTML = shell(`
    <div class="tabs-nav">
      ${tabs.map((t, idx) => `
        <button class="tab-btn ${activeTab === idx ? 'active' : ''}" data-a="set-tab" data-tab="${idx}">
          ${t.icon} ${t.label}
        </button>
      `).join('')}
    </div>
    ${tabContent}
  `);
}

// ---------- EXAM TAKER ENGINE (DISTRACTION FREE & MODERN) ----------
function renderExamTaker() {
  if (!E) return;
  const q = E.qs[E.i];
  const curAns = E.ans[q.id];
  const isMarked = !!E.mk[q.id];

  // Calculate answered questions
  const answeredCount = Object.keys(E.ans).filter(k => E.ans[k] !== null && E.ans[k] !== '').length;
  const progressPct = E.qs.length ? (answeredCount / E.qs.length) * 100 : 0;

  app.innerHTML = shell(`
    <div class="exam-wrapper">
      <div class="exam-topbar">
        <div class="flex items-center gap-4">
          <div class="exam-timer" id="exam-timer">⏱ --:--</div>
          <span id="save-sync-status" class="badge badge-success">✓ Autosaved</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm" style="color: #94a3b8; font-family: 'JetBrains Mono', monospace;">
            ${Math.round(progressPct)}% Answered
          </span>
          <button class="btn btn-danger btn-sm" data-a="submit-exam-confirm">
            Finish & Submit Exam
          </button>
        </div>
      </div>

      <!-- Animated Progress Bar -->
      <div style="height: 6px; background: rgba(226, 232, 240, 0.8); border-radius: 999px; overflow: hidden; margin-bottom: 1.5rem;">
        <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #4f46e5, #06b6d4); transition: width 0.3s ease;"></div>
      </div>

      <div class="pal-legend">
        <div class="legend-item"><div class="legend-dot" style="background: var(--success);"></div> Answered (${answeredCount})</div>
        <div class="legend-item"><div class="legend-dot" style="background: var(--warning);"></div> Marked for Review (${Object.keys(E.mk).filter(k=>E.mk[k]).length})</div>
        <div class="legend-item"><div class="legend-dot" style="background: var(--surface); border: 2px solid var(--primary);"></div> Current Question</div>
      </div>

      <div class="exam-palette" id="exam-pal">
        ${E.qs.map((item, idx) => {
          const isAns = item.id in E.ans && E.ans[item.id] !== null && E.ans[item.id] !== '';
          const isCur = idx === E.i;
          const isM = !!E.mk[item.id];
          let c = 'pal-btn';
          if (isCur) c += ' current';
          if (isM) c += ' marked';
          else if (isAns) c += ' answered';
          return `<button class="${c}" data-a="jump-q" data-idx="${idx}">${idx + 1}</button>`;
        }).join('')}
      </div>

      <div class="q-box">
        <div class="q-meta">
          <span>Question ${E.i + 1} of ${E.qs.length}</span>
          <span class="badge badge-primary">+${q.marks} Mark(s)</span>
        </div>
        <div class="q-text">${esc(q.text)}</div>

        <div data-qid="${q.id}">
          ${renderQuestionInputs(q, curAns)}
        </div>
      </div>

      <div class="flex justify-between items-center">
        <button class="btn btn-secondary" data-a="nav-q" data-dir="-1" ${E.i === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        <button class="btn ${isMarked ? 'btn-warning' : 'btn-outline'}" data-a="toggle-mark">
          ${isMarked ? '🚩 Marked for Review' : '⚐ Mark for Review'}
        </button>
        <button class="btn btn-primary" data-a="nav-q" data-dir="1" ${E.i === E.qs.length - 1 ? 'disabled' : ''}>
          Next Question →
        </button>
      </div>
    </div>
  `);

  tickExamTimer();
}

function renderQuestionInputs(q, curAns) {
  if (q.type === 'single' || q.type === 'true_false') {
    const opts = q.type === 'true_false' ? ['True', 'False'] : q.options;
    const vals = q.type === 'true_false' ? ['true', 'false'] : opts.map((_, idx) => String(idx));
    return opts.map((opt, idx) => {
      const isSel = String(curAns) === String(vals[idx]);
      return `
        <label class="opt-card ${isSel ? 'selected' : ''}">
          <input type="radio" name="opt" value="${vals[idx]}" ${isSel ? 'checked' : ''} style="display:none">
          <span style="font-weight: 700; width: 26px; height: 26px; border-radius: 50%; background: ${isSel ? 'var(--primary)' : 'var(--surface-subtle)'}; color: ${isSel ? '#fff' : 'var(--text-main)'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; margin-right: 0.5rem;">
            ${String.fromCharCode(65 + idx)}
          </span>
          <span style="font-size: 0.95rem;">${esc(opt)}</span>
        </label>
      `;
    }).join('');
  } else if (q.type === 'multiple') {
    const arr = Array.isArray(curAns) ? curAns : [];
    return q.options.map((opt, idx) => {
      const isSel = arr.includes(idx);
      return `
        <label class="opt-card ${isSel ? 'selected' : ''}">
          <input type="checkbox" name="opt" value="${idx}" ${isSel ? 'checked' : ''} style="display:none">
          <span style="font-weight: 700; width: 26px; height: 26px; border-radius: 6px; background: ${isSel ? 'var(--primary)' : 'var(--surface-subtle)'}; color: ${isSel ? '#fff' : 'var(--text-main)'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; margin-right: 0.5rem;">
            ${String.fromCharCode(65 + idx)}
          </span>
          <span style="font-size: 0.95rem;">${esc(opt)}</span>
        </label>
      `;
    }).join('');
  } else {
    return `
      <input type="${q.type === 'numerical' ? 'number' : 'text'}" 
             class="form-control" 
             style="font-size: 1.1rem; padding: 0.85rem;"
             placeholder="Type your final answer here..." 
             value="${esc(curAns ?? '')}">
    `;
  }
}

function tickExamTimer() {
  const el = document.getElementById('exam-timer');
  if (!el || !E) return;
  const remaining = Math.max(0, Math.floor((E.dl - (Date.now() + E.off)) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  el.textContent = `⏱ ${m}:${s}`;
  if (remaining < 300) {
    el.className = 'exam-timer timer-danger';
  }
  if (remaining <= 0) {
    submitExam(true);
  }
}

async function flushExamAnswers() {
  if (!E) return;
  const items = Object.values(E.pend);
  if (!items.length) return;
  const syncEl = document.getElementById('save-sync-status');
  if (syncEl) syncEl.textContent = '⏳ Saving...';
  try {
    await api(`/attempts/${E.att}/answers`, 'PUT', items);
    items.forEach(i => {
      if (E.pend[i.question_id] === i) delete E.pend[i.question_id];
    });
    if (syncEl) {
      syncEl.textContent = '✓ Autosaved';
      syncEl.className = 'badge badge-success';
    }
  } catch (err) {
    if (syncEl) {
      syncEl.textContent = '⚠ Offline – retrying';
      syncEl.className = 'badge badge-warning';
    }
  }
}

async function submitExam(auto = false) {
  if (!E || E.busy) return;
  E.busy = true;
  await flushExamAnswers();
  try {
    await api(`/attempts/${E.att}/submit`, 'POST');
    clearInterval(timerInterval);
    clearInterval(saverInterval);
    E = null;
    modalContent = null;
    toast(auto ? 'Time elapsed. Exam submitted automatically.' : 'Exam submitted successfully!');
    await render();
  } catch (err) {
    E.busy = false;
  }
}

// ---------- EVENT DISPATCHER ----------
document.addEventListener('click', async e => {
  const target = e.target.closest('[data-a]');
  if (!target) return;
  const action = target.dataset.a;

  try {
    if (action === 'logout') {
      logout();
    } else if (action === 'set-tab') {
      activeTab = parseInt(target.dataset.tab);
      render();
    } else if (action === 'close-modal') {
      modalContent = null;
      render();
    } else if (action === 'open-google-auth') {
      openGoogleAuthModal(target.dataset.role || 'student');
    } else if (action === 'switch-reg-tab') {
      const role = target.dataset.role || 'student';
      const sb = document.getElementById('reg-box-student');
      const fb = document.getElementById('reg-box-faculty');
      const sBtn = document.getElementById('tab-btn-student');
      const fBtn = document.getElementById('tab-btn-faculty');
      if (role === 'faculty') {
        if (sb) sb.style.display = 'none';
        if (fb) fb.style.display = 'block';
        if (sBtn) sBtn.classList.remove('active');
        if (fBtn) fBtn.classList.add('active');
      } else {
        if (sb) sb.style.display = 'block';
        if (fb) fb.style.display = 'none';
        if (sBtn) sBtn.classList.add('active');
        if (fBtn) fBtn.classList.remove('active');
      }
    } else if (action === 'select-all-qs') {
      F.qs.forEach(q => F.selectedQs.add(q.id));
      document.querySelectorAll('.qsel').forEach(cb => {
        cb.checked = true;
        const card = cb.closest('.opt-card');
        if (card) card.classList.add('selected');
      });
      updateQuestionSelectionUI();
    } else if (action === 'clear-all-qs') {
      F.selectedQs.clear();
      document.querySelectorAll('.qsel').forEach(cb => {
        cb.checked = false;
        const card = cb.closest('.opt-card');
        if (card) card.classList.remove('selected');
      });
      updateQuestionSelectionUI();
    } else if (action === 'self-enroll') {
      await api(`/courses/${target.dataset.id}/self-enroll`, 'POST');
      toast('Successfully enrolled in course!');
      render();
    } else if (action === 'toggle-user') {
      await api(`/users/${target.dataset.id}/status`, 'PATCH', { status: target.dataset.status });
      toast('User status updated');
      render();
    } else if (action === 'delete-user') {
      if (!confirm(`Are you sure you want to permanently delete user "${target.dataset.name}"?`)) return;
      await api(`/users/${target.dataset.id}`, 'DELETE');
      toast('User deleted successfully');
      render();
    } else if (action === 'edit-user-modal') {
      const u = JSON.parse(target.dataset.user);
      modalContent = `
        <div class="modal-header">
          <div class="card-title">✏️ Edit User #${u.id}</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <form data-f="update-user" data-id="${u.id}">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" name="name" class="form-control" value="${esc(u.name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-control" value="${esc(u.email)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select name="role" class="form-control">
              <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
              <option value="faculty" ${u.role === 'faculty' ? 'selected' : ''}>Faculty</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Reset Password (leave blank to keep current)</label>
            <input type="password" name="password" class="form-control" placeholder="New Password (10+ characters)">
          </div>
          <div class="flex justify-between items-center mt-4">
            <button type="button" class="btn btn-secondary" data-a="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      `;
      render();
    } else if (action === 'edit-course-modal') {
      const c = JSON.parse(target.dataset.course);
      const users = await api('/users');
      const faculties = users.filter(u => u.role === 'faculty');
      modalContent = `
        <div class="modal-header">
          <div class="card-title">✏️ Edit Course #${c.id}</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <form data-f="update-course" data-id="${c.id}">
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" name="code" class="form-control" value="${esc(c.code)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Course Title</label>
            <input type="text" name="name" class="form-control" value="${esc(c.name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Faculty Lead</label>
            <select name="faculty_id" class="form-control">
              <option value="">Unassigned</option>
              ${faculties.map(f => `
                <option value="${f.id}" ${f.id == c.faculty_id ? 'selected' : ''}>${esc(f.name)} (${esc(f.email)})</option>
              `).join('')}
            </select>
          </div>
          <div class="flex justify-between items-center mt-4">
            <button type="button" class="btn btn-secondary" data-a="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Course</button>
          </div>
        </form>
      `;
      render();
    } else if (action === 'delete-course') {
      if (!confirm(`Are you sure you want to permanently delete course "${target.dataset.name}" and its associated tests?`)) return;
      await api(`/courses/${target.dataset.id}`, 'DELETE');
      toast('Course deleted successfully');
      render();
    } else if (action === 'delete-test') {
      if (!confirm(`Are you sure you want to delete examination "${target.dataset.title}"?`)) return;
      await api(`/tests/${target.dataset.id}`, 'DELETE');
      toast('Examination deleted');
      render();
    } else if (action === 'edit-test-modal') {
      const t = JSON.parse(target.dataset.test);
      const startIso = new Date(new Date(t.start_at).getTime() - new Date(t.start_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const endIso = new Date(new Date(t.end_at).getTime() - new Date(t.end_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      modalContent = `
        <div class="modal-header">
          <div class="card-title">✏️ Modify Examination #${t.id}</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <form data-f="update-test" data-id="${t.id}">
          <div class="form-group">
            <label class="form-label">Exam Title</label>
            <input type="text" name="title" class="form-control" value="${esc(t.title)}" required>
          </div>
          <div class="form-row">
            <div>
              <label class="form-label">Duration (Minutes)</label>
              <input type="number" name="duration_min" class="form-control" value="${t.duration_min}" min="1" required>
            </div>
            <div>
              <label class="form-label">Pass Marks</label>
              <input type="number" name="pass_marks" class="form-control" value="${t.pass_marks}" min="0" required>
            </div>
          </div>
          <div class="form-row">
            <div>
              <label class="form-label">Start Time</label>
              <input type="datetime-local" name="start_at" class="form-control" value="${startIso}" required>
            </div>
            <div>
              <label class="form-label">End Time</label>
              <input type="datetime-local" name="end_at" class="form-control" value="${endIso}" required>
            </div>
          </div>
          <div class="flex justify-between items-center mt-4">
            <button type="button" class="btn btn-secondary" data-a="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Test Settings</button>
          </div>
        </form>
      `;
      render();
    } else if (action === 'delete-q') {
      if (!confirm('Are you sure you want to remove this question?')) return;
      await api(`/questions/${target.dataset.id}`, 'DELETE');
      toast('Question archived');
      render();
    } else if (action === 'edit-q-modal') {
      const q = JSON.parse(target.dataset.q);
      modalContent = `
        <div class="modal-header">
          <div class="card-title">✏️ Edit Question #${q.id}</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <form data-f="update-q" data-id="${q.id}">
          <div class="form-group">
            <label class="form-label">Question Text</label>
            <textarea name="text" class="form-control" rows="3" required>${esc(q.text)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Question Type</label>
            <select name="type" class="form-control">
              <option value="single" ${q.type === 'single' ? 'selected' : ''}>Single Choice</option>
              <option value="multiple" ${q.type === 'multiple' ? 'selected' : ''}>Multiple Choice</option>
              <option value="true_false" ${q.type === 'true_false' ? 'selected' : ''}>True / False</option>
              <option value="numerical" ${q.type === 'numerical' ? 'selected' : ''}>Numerical</option>
              <option value="fill" ${q.type === 'fill' ? 'selected' : ''}>Fill in Blank</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Options (One per line)</label>
            <textarea name="options" class="form-control" rows="3">${esc((q.options || []).join('\n'))}</textarea>
          </div>
          <div class="form-row">
            <div>
              <label class="form-label">Correct Option (0-indexed number or True/False)</label>
              <input type="text" name="correct" class="form-control" value="${esc(JSON.stringify(q.correct))}">
            </div>
            <div>
              <label class="form-label">Marks</label>
              <input type="number" name="marks" class="form-control" value="${q.marks}" min="1">
            </div>
          </div>
          <div class="flex justify-between items-center mt-4">
            <button type="button" class="btn btn-secondary" data-a="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Question</button>
          </div>
        </form>
      `;
      render();
    } else if (action === 'pub') {
      await api(`/tests/${target.dataset.id}/publish`, 'POST', { published: target.dataset.v === 'true' });
      toast('Test status changed');
      render();
    } else if (action === 'rel') {
      await api(`/tests/${target.dataset.id}/release`, 'POST', { released: target.dataset.v === 'true' });
      toast('Results status updated');
      render();
    } else if (action === 'get-share') {
      const res = await api(`/tests/${target.dataset.id}/share`, 'POST');
      const shareUrl = `${window.location.origin}/#/join/${res.share_code}`;
      modalContent = `
        <div class="modal-header">
          <div class="card-title">🔗 Exam Invitation Link</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <p class="text-sm text-muted mb-4">
          Share this URL with students. Anyone with this link can instantly register and write the exam within the active window.
        </p>
        <div class="form-group">
          <input type="text" id="share-link-input" class="form-control" value="${shareUrl}" readonly>
        </div>
        <div class="flex justify-between items-center mt-4">
          <span class="badge badge-info">Code: ${res.share_code}</span>
          <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${shareUrl}').then(()=>toast('Copied exam link to clipboard!'))">
            📋 Copy Link
          </button>
        </div>
      `;
      render();
    } else if (action === 'view-students') {
      const list = await api(`/tests/${target.dataset.id}/students`);
      modalContent = `
        <div class="modal-header">
          <div class="card-title">👥 Assigned Students (${list.length})</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Attempt Status</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${list.length ? list.map(s => {
                const status = s.submitted_at 
                  ? `<span class="badge badge-success">Submitted</span>`
                  : s.started_at 
                    ? `<span class="badge badge-warning">In Progress</span>`
                    : `<span class="badge badge-muted">Not Started</span>`;
                const scoreDisplay = s.score !== null ? `<strong>${s.score}/${s.total}</strong> (${s.passed ? 'Pass' : 'Fail'})` : '—';
                return `
                  <tr>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td>${esc(s.email)}</td>
                    <td>${status}</td>
                    <td>${scoreDisplay}</td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="4" class="text-center text-muted" style="padding: 1.5rem;">No students enrolled yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      render();
    } else if (action === 'enroll-and-start') {
      const code = target.dataset.code;
      await api(`/tests/join/${code}`, 'POST');
      toast('Enrolled in exam course!');
      window.location.hash = '';
      render();
    } else if (action === 'start-exam') {
      const testId = target.dataset.id;
      const res = await api(`/tests/${testId}/start`, 'POST');
      E = {
        att: res.attempt_id,
        qs: res.questions,
        i: 0,
        ans: {},
        mk: {},
        pend: {},
        off: Date.parse(res.server_time) - Date.now(),
        dl: Date.parse(res.deadline)
      };
      res.saved.forEach(s => {
        E.ans[s.question_id] = s.answer;
        E.mk[s.question_id] = s.marked;
      });
      timerInterval = setInterval(tickExamTimer, 1000);
      saverInterval = setInterval(flushExamAnswers, 4000);
      render();
    } else if (action === 'jump-q') {
      E.i = parseInt(target.dataset.idx);
      renderExamTaker();
    } else if (action === 'nav-q') {
      E.i += parseInt(target.dataset.dir);
      renderExamTaker();
    } else if (action === 'toggle-mark') {
      const qid = E.qs[E.i].id;
      E.mk[qid] = !E.mk[qid];
      E.pend[qid] = { question_id: qid, answer: E.ans[qid] ?? null, marked: !!E.mk[qid] };
      renderExamTaker();
    } else if (action === 'submit-exam-confirm') {
      modalContent = `
        <div class="modal-header">
          <div class="card-title">⚠️ Confirm Test Submission</div>
          <button class="close-btn" data-a="close-modal">&times;</button>
        </div>
        <p class="mb-4">Are you sure you want to finish and submit your exam? You cannot change your answers after submission.</p>
        <div class="flex justify-between items-center">
          <button class="btn btn-secondary" data-a="close-modal">Continue Test</button>
          <button class="btn btn-danger" data-a="submit-exam-final">Confirm & Submit</button>
        </div>
      `;
      render();
    } else if (action === 'submit-exam-final') {
      submitExam(false);
    } else if (action === 'student-result') {
      const r = await api(`/attempts/${target.dataset.id}/result`);
      const scoreCard = document.getElementById('student-scorecard');
      const th = getCourseTheme(r.course_code, r.course_name);
      if (scoreCard) {
        scoreCard.innerHTML = `
          <div class="card ${th.themeClass}" style="border: 2px solid ${r.passed ? 'var(--success)' : 'var(--danger)'};">
            <div class="card-header">
              <div>
                <div class="card-title">${th.icon} Official Scorecard: ${esc(r.title)}</div>
                <div class="text-sm text-muted">${esc(r.course_code)} - ${esc(r.course_name)}</div>
              </div>
              <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div class="stats-grid" style="margin-bottom: 0;">
              <div class="stat-card">
                <span class="stat-label">Final Score</span>
                <span class="stat-value">${r.score} / ${r.total}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Correct Answers</span>
                <span class="stat-value" style="color: var(--success);">${r.correct}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Incorrect Answers</span>
                <span class="stat-value" style="color: var(--danger);">${r.wrong}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Unattempted</span>
                <span class="stat-value">${r.unattempted}</span>
              </div>
            </div>
          </div>
        `;
      }
    } else if (action === 'load-analytics') {
      const testId = document.getElementById('res-test-select').value;
      if (!testId) return toast('Please select an exam first', 'error');
      const data = await api(`/tests/${testId}/results`);
      const s = data.stats;
      const container = document.getElementById('analytics-container');
      container.innerHTML = `
        <div class="stats-grid mb-4">
          <div class="stat-card"><span class="stat-label">Appeared</span><span class="stat-value">${s.appeared || 0}</span></div>
          <div class="stat-card"><span class="stat-label">Average Score</span><span class="stat-value">${s.avg ? (+s.avg).toFixed(1) : 0}</span></div>
          <div class="stat-card"><span class="stat-label">Highest Score</span><span class="stat-value" style="color: var(--success);">${s.highest ?? 0}</span></div>
          <div class="stat-card"><span class="stat-label">Pass Percentage</span><span class="stat-value">${s.pass_pct ? (+s.pass_pct).toFixed(0) + '%' : '0%'}</span></div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr><th>Rank</th><th>Student Name</th><th>Email</th><th>Score</th><th>Result</th></tr>
            </thead>
            <tbody>
              ${data.rows.map(r => `
                <tr>
                  <td><strong>#${r.rank}</strong></td>
                  <td>${esc(r.name)}</td>
                  <td>${esc(r.email)}</td>
                  <td><strong>${r.score}</strong> / ${r.total}</td>
                  <td><span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? 'Pass' : 'Fail'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (action === 'download-csv') {
      const testId = document.getElementById('res-test-select').value;
      if (!testId) return toast('Please select an exam first', 'error');
      const csv = await api(`/tests/${testId}/results?format=csv`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ExamFlow-Test-${testId}-Analytics.csv`;
      a.click();
      toast('CSV report generated');
    } else if (action === 'browse-doc' || action === 'dropzone-click') {
      const fi = document.getElementById('extractor-file-input');
      if (fi) fi.click();
    } else if (action === 'clear-uploaded-file') {
      const statusBox = document.getElementById('upload-status-box');
      if (statusBox) statusBox.style.display = 'none';
      const fi = document.getElementById('extractor-file-input');
      if (fi) fi.value = '';
    } else if (action === 'draft-select-all') {
      document.querySelectorAll('#drafts .dsel').forEach(cb => cb.checked = true);
    } else if (action === 'draft-deselect-all') {
      document.querySelectorAll('#drafts .dsel').forEach(cb => cb.checked = false);
    } else if (action === 'draft-clear-all') {
      F.drafts = [];
      drawDrafts();
      const statusBox = document.getElementById('upload-status-box');
      if (statusBox) statusBox.style.display = 'none';
      toast('Drafts cleared');
    } else if (action === 'draft-remove') {
      const idx = +target.dataset.idx;
      if (!isNaN(idx)) {
        F.drafts.splice(idx, 1);
        drawDrafts();
      }
    } else if (action === 'savedrafts') {
      let savedCount = 0;
      for (const card of document.querySelectorAll('#drafts [data-d]')) {
        const checkbox = card.querySelector('.dsel');
        if (!checkbox || !checkbox.checked) continue;
        let options = card.querySelector('.do').value.split('\n').map(s => s.trim()).filter(Boolean);
        const typeSelect = card.querySelector('.dtype');
        const qType = typeSelect ? typeSelect.value : 'single';
        const rawAns = (card.querySelector('.dc').value || '').trim();
        let correct = [];
        let finalType = qType;

        if (qType === 'true_false' || /^(true|false)$/i.test(rawAns)) {
          finalType = 'true_false';
          const isTrue = /^(true|t|a|1)$/i.test(rawAns);
          correct = [isTrue ? 'true' : 'false'];
          if (options.length < 2) options = ['True', 'False'];
        } else {
          correct = rawAns.toUpperCase().split(/[,\s]+/).filter(c => /^[A-H]$/.test(c)).map(c => c.charCodeAt(0) - 65);
          if (!correct.length && options.length) {
            const matchIdx = options.findIndex(o => o.toLowerCase().trim() === rawAns.toLowerCase());
            if (matchIdx !== -1) correct = [matchIdx];
          }
          finalType = correct.length > 1 ? 'multiple' : 'single';
        }

        if (!correct.length || options.length < 2) {
          throw new Error('All questions must have at least 2 options and a valid answer');
        }

        const expInput = card.querySelector('.de');
        const createdQ = await api('/questions', 'POST', {
          course_id: F.course,
          type: finalType,
          text: card.querySelector('.dt').value.trim(),
          options,
          correct,
          marks: +card.querySelector('.dm').value || 1,
          explanation: expInput ? expInput.value.trim() : ''
        });

        if (createdQ && createdQ.id) F.selectedQs.add(createdQ.id);
        savedCount++;
      }

      F.drafts = [];
      toast(`Successfully saved ${savedCount} question(s) to Question Bank!`);
      activeTab = 0;
      await render();
    }
  } catch (err) {
    console.error(err);
  }
});

// ---------- FORM SUBMISSIONS ----------
document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-f]');
  if (!form) return;
  e.preventDefault();
  const fType = form.dataset.f;
  const formData = Object.fromEntries(new FormData(form));

  try {
    if (fType === 'login') {
      const res = await api('/auth/login', 'POST', formData);
      setAuth(res.token, res.user);
      toast(`Signed in as ${res.user.name}`);
      const pendingJoin = sessionStorage.getItem('join_code');
      if (pendingJoin) {
        sessionStorage.removeItem('join_code');
        window.location.hash = `#/join/${pendingJoin}`;
      } else {
        window.location.hash = '#/dashboard';
      }
    } else if (fType === 'register') {
      const res = await api('/auth/register', 'POST', formData);
      setAuth(res.token, res.user);
      toast(`Registered successfully as ${res.user.role}! Welcome, ${res.user.name}!`);
      const pendingJoin = sessionStorage.getItem('join_code');
      if (pendingJoin) {
        sessionStorage.removeItem('join_code');
        window.location.hash = `#/join/${pendingJoin}`;
      } else {
        window.location.hash = '#/dashboard';
      }
    } else if (fType === 'google-auth') {
      const res = await api('/auth/google', 'POST', formData);
      setAuth(res.token, res.user);
      modalContent = null;
      toast(`Signed in with Google as ${res.user.name}!`);
      const pendingJoin = sessionStorage.getItem('join_code');
      if (pendingJoin) {
        sessionStorage.removeItem('join_code');
        window.location.hash = `#/join/${pendingJoin}`;
      } else {
        window.location.hash = '#/dashboard';
      }
    } else if (fType === 'update-profile') {
      const res = await api('/auth/profile', 'PUT', formData);
      S.user = res.user;
      localStorage.setItem('ef_user', JSON.stringify(res.user));
      toast('Profile details updated successfully!');
      render();
    } else if (fType === 'join-register') {
      const res = await api('/auth/register', 'POST', formData);
      setAuth(res.token, res.user);
      const code = form.dataset.code;
      await api(`/tests/join/${code}`, 'POST');
      toast('Registered and joined exam!');
      window.location.hash = '';
      render();
    } else if (fType === 'mkuser') {
      await api('/users', 'POST', formData);
      toast('User created successfully');
      render();
    } else if (fType === 'update-user') {
      await api(`/users/${form.dataset.id}`, 'PUT', formData);
      modalContent = null;
      toast('User profile updated successfully');
      render();
    } else if (fType === 'mkcourse') {
      await api('/courses', 'POST', { ...formData, faculty_id: +formData.faculty_id });
      toast('Course created successfully');
      render();
    } else if (fType === 'update-course') {
      await api(`/courses/${form.dataset.id}`, 'PUT', { ...formData, faculty_id: formData.faculty_id ? +formData.faculty_id : null });
      modalContent = null;
      toast('Course details updated');
      render();
    } else if (fType === 'update-test') {
      await api(`/tests/${form.dataset.id}`, 'PUT', {
        title: formData.title,
        duration_min: +formData.duration_min,
        pass_marks: +formData.pass_marks,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: new Date(formData.end_at).toISOString()
      });
      modalContent = null;
      toast('Exam updated successfully');
      render();
    } else if (fType === 'update-q') {
      const opts = formData.options.split('\n').map(s => s.trim()).filter(Boolean);
      let cor;
      try { cor = JSON.parse(formData.correct); } catch { cor = [formData.correct]; }
      await api(`/questions/${form.dataset.id}`, 'PUT', {
        text: formData.text,
        type: formData.type,
        options: opts,
        correct: cor,
        marks: +formData.marks
      });
      modalContent = null;
      toast('Question updated');
      render();
    } else if (fType === 'enroll') {
      const sIds = formData.student_ids.split(',').map(s => parseInt(s.trim())).filter(Boolean);
      await api(`/courses/${formData.course_id}/enroll`, 'POST', { student_ids: sIds });
      toast(`Enrolled ${sIds.length} student(s)`);
      render();
    } else if (fType === 'parse') {
      F.drafts = await api('/questions/parse', 'POST', formData);
      drawDrafts();
      toast(`Extracted ${F.drafts.length} draft question(s)`);
    } else if (fType === 'mktest') {
      let checkedQs = Array.from(F.selectedQs);
      if (!checkedQs.length) {
        checkedQs = [...document.querySelectorAll('.qsel:checked')].map(c => +c.value);
      }
      if (!checkedQs.length) {
        return toast('Please tick at least one question below to create the exam', 'error');
      }
      await api('/tests', 'POST', {
        course_id: F.course,
        title: formData.title,
        duration_min: +formData.duration_min,
        pass_marks: +formData.pass_marks,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: new Date(formData.end_at).toISOString(),
        question_ids: checkedQs
      });
      toast('🎉 Examination created successfully! Link is ready to share.');
      render();
    }
  } catch (err) {
    console.error(err);
  }
});

// ---------- INPUT CHANGE LISTENERS ----------
document.addEventListener('change', e => {
  // Extractor File Upload Changed
  if (e.target.id === 'extractor-file-input') {
    const file = e.target.files && e.target.files[0];
    if (file) handleQuestionFileUpload(file);
    return;
  }

  // Course Selector Changed
  if (e.target.dataset.c !== undefined) {
    F.course = +e.target.value;
    F.selectedQs.clear();
    render();
    return;
  }

  // Question Checkbox Toggled
  if (e.target.classList.contains('qsel')) {
    const qid = +e.target.value;
    const card = e.target.closest('.opt-card');
    if (e.target.checked) {
      F.selectedQs.add(qid);
      if (card) card.classList.add('selected');
    } else {
      F.selectedQs.delete(qid);
      if (card) card.classList.remove('selected');
    }
    updateQuestionSelectionUI();
  }
});

// Drag and Drop listeners for Question Extractor
document.addEventListener('dragover', e => {
  const dropzone = e.target.closest('#extractor-dropzone');
  if (dropzone) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }
});

document.addEventListener('dragleave', e => {
  const dropzone = e.target.closest('#extractor-dropzone');
  if (dropzone && !dropzone.contains(e.relatedTarget)) {
    dropzone.classList.remove('dragover');
  }
});

document.addEventListener('drop', e => {
  const dropzone = e.target.closest('#extractor-dropzone');
  if (dropzone) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleQuestionFileUpload(file);
  }
});

// Exam Option Selection listener (during active student exam)
document.addEventListener('input', e => {
  const container = e.target.closest('[data-qid]');
  if (!container || !E) return;
  const qid = +container.dataset.qid;
  const q = E.qs.find(x => x.id === qid);
  if (!q) return;

  if (q.type === 'multiple') {
    E.ans[qid] = [...container.querySelectorAll('input:checked')].map(x => +x.value);
  } else {
    E.ans[qid] = e.target.value;
  }
  E.pend[qid] = { question_id: qid, answer: E.ans[qid] ?? null, marked: !!E.mk[qid] };

  // Update styling
  container.querySelectorAll('.opt-card').forEach(card => {
    const inp = card.querySelector('input');
    if (inp) {
      if (inp.checked) card.classList.add('selected');
      else card.classList.remove('selected');
    }
  });

  // Update palette button
  const palBtn = document.querySelector(`.pal-btn[data-idx="${E.i}"]`);
  if (palBtn) {
    const isAns = E.ans[qid] !== null && E.ans[qid] !== '';
    if (isAns && !E.mk[qid]) palBtn.classList.add('answered');
  }
});

// Prevent accidental navigation during test
window.addEventListener('beforeunload', e => {
  if (E) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Initial boot
render().catch(err => toast(err.message, 'error'));
