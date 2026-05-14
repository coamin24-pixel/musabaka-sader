/* ===== Admin Panel JavaScript ===== */

let db = null; // Supabase client instance
let currentPage = 'dashboard';
let allStudents = [];
let allQuestions = [];
let allDays = [];
let pendingStudentsUpload = null;
let pendingQuestionsUpload = null;
let editingStudentId = null;
let editingQuestionId = null;

// ===== Authentication =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if already authenticated this session
    if (sessionStorage.getItem('adminAuth') === 'true') {
        showAdminApp();
    } else {
        showLoginScreen();
    }

    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Setup navigation
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            switchPage(page);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('adminAuth');
        location.reload();
    });

    // Mobile menu
    const menuToggle = document.getElementById('mobileMenuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('adminSidebar').classList.toggle('open');
        });
    }

    setupEventHandlers();
});

function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    if (password === SUPABASE_CONFIG.ADMIN_PASSWORD) {
        sessionStorage.setItem('adminAuth', 'true');
        showAdminApp();
    } else {
        errorEl.textContent = '❌ كلمة المرور غير صحيحة';
        errorEl.style.display = 'block';
        document.getElementById('adminPassword').value = '';
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminApp').style.display = 'none';
}

function showAdminApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';

    // Initialize Supabase
    db = initSupabase();
    if (!db) {
        showToast('error', 'فشل الاتصال بقاعدة البيانات. يرجى التحقق من config.js');
        return;
    }

    // Load initial data
    loadDashboard();
}

// ===== Page Switching =====
function switchPage(page) {
    currentPage = page;

    // Update nav
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.admin-page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Close mobile sidebar
    document.getElementById('adminSidebar').classList.remove('open');

    // Load page data
    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'students':
            loadStudents();
            break;
        case 'days':
            loadDays();
            break;
        case 'questions':
            loadQuestionsPage();
            break;
        case 'results':
            loadResultsPage();
            break;
    }
}

// ===== Dashboard =====
async function loadDashboard() {
    try {
        // Total students
        const { count: studentsCount } = await db
            .from('students')
            .select('*', { count: 'exact', head: true });

        // Total questions
        const { count: questionsCount } = await db
            .from('questions')
            .select('*', { count: 'exact', head: true });

        // Total sessions (completed)
        const { count: sessionsCount } = await db
            .from('quiz_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('is_completed', true);

        // Total days
        const { count: daysCount } = await db
            .from('competition_days')
            .select('*', { count: 'exact', head: true });

        document.getElementById('statStudents').textContent = studentsCount || 0;
        document.getElementById('statQuestions').textContent = questionsCount || 0;
        document.getElementById('statSessions').textContent = sessionsCount || 0;
        document.getElementById('statDays').textContent = daysCount || 0;

        // Active day
        const { data: activeDay } = await db
            .from('competition_days')
            .select('*')
            .eq('is_active', true)
            .limit(1)
            .single();

        const banner = document.getElementById('activeDayBanner');
        if (activeDay) {
            banner.style.display = 'flex';
            document.getElementById('activeDayName').textContent = activeDay.day_name;
            document.getElementById('activeDayDate').textContent = activeDay.day_date || 'اليوم';
        } else {
            banner.style.display = 'none';
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('error', 'فشل تحميل الإحصائيات');
    }
}

// ===== Students Management =====
async function loadStudents() {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">⏳ جاري التحميل...</td></tr>';

    try {
        const { data, error } = await db
            .from('students')
            .select('*')
            .order('class_section', { ascending: true })
            .order('student_number', { ascending: true });

        if (error) throw error;

        allStudents = data || [];
        renderStudentsTable(allStudents);
    } catch (error) {
        console.error('Load students error:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="loading-row">❌ فشل التحميل</td></tr>';
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <h3>لا يوجد طلاب</h3>
                    <p>قم برفع ملف Excel أو إضافة طالب يدوياً</p>
                </div>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr>
            <td><strong>${escapeHtml(s.student_number)}</strong></td>
            <td>${escapeHtml(s.student_name || '-')}</td>
            <td><span class="status-badge">${escapeHtml(s.class_section)}</span></td>
            <td>${formatDate(s.created_at)}</td>
            <td>
                <div class="actions">
                    <button class="btn-icon" onclick="editStudent('${s.id}')" title="تعديل">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button class="btn-icon danger" onclick="deleteStudent('${s.id}', '${escapeHtml(s.student_number)}')" title="حذف">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Student search
document.addEventListener('input', (e) => {
    if (e.target.id === 'studentSearch') {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allStudents.filter(s =>
            s.student_number.toLowerCase().includes(query) ||
            (s.student_name && s.student_name.toLowerCase().includes(query)) ||
            s.class_section.toLowerCase().includes(query)
        );
        renderStudentsTable(filtered);
    }
});

// ===== Excel Upload for Students =====
function setupEventHandlers() {
    // Students Excel upload
    const studentsUpload = document.getElementById('studentsUploadArea');
    const studentsInput = document.getElementById('studentsFileInput');

    if (studentsUpload && studentsInput) {
        studentsUpload.addEventListener('click', () => studentsInput.click());

        studentsUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            studentsUpload.classList.add('dragover');
        });

        studentsUpload.addEventListener('dragleave', () => {
            studentsUpload.classList.remove('dragover');
        });

        studentsUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            studentsUpload.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleStudentsFile(file);
        });

        studentsInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleStudentsFile(file);
        });
    }

    // Questions Word upload
    const questionsUpload = document.getElementById('questionsUploadArea');
    const questionsInput = document.getElementById('questionsFileInput');

    if (questionsUpload && questionsInput) {
        questionsUpload.addEventListener('click', () => questionsInput.click());

        questionsUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            questionsUpload.classList.add('dragover');
        });

        questionsUpload.addEventListener('dragleave', () => {
            questionsUpload.classList.remove('dragover');
        });

        questionsUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            questionsUpload.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleQuestionsFile(file);
        });

        questionsInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleQuestionsFile(file);
        });
    }

    // Buttons
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadStudentsTemplate);
    }

    const addStudentBtn = document.getElementById('addStudentBtn');
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', () => openStudentModal());
    }

    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', saveStudent);
    }

    const addDayBtn = document.getElementById('addDayBtn');
    if (addDayBtn) {
        addDayBtn.addEventListener('click', () => openDayModal());
    }

    const dayForm = document.getElementById('dayForm');
    if (dayForm) {
        dayForm.addEventListener('submit', saveDay);
    }

    const addQuestionBtn = document.getElementById('addQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => openQuestionModal());
    }

    const questionForm = document.getElementById('questionForm');
    if (questionForm) {
        questionForm.addEventListener('submit', saveQuestion);
    }

    // Filters
    const questionFilterDay = document.getElementById('questionFilterDay');
    if (questionFilterDay) {
        questionFilterDay.addEventListener('change', filterQuestions);
    }
    const questionFilterSubject = document.getElementById('questionFilterSubject');
    if (questionFilterSubject) {
        questionِِFilterSubject.addEventListener('change', filterQuestions);
    }

    // Results filter
    const resultsFilterDay = document.getElementById('resultsFilterDay');
    if (resultsFilterDay) {
        resultsFilterDay.addEventListener('change', loadResultsData);
    }

    const exportResultsBtn = document.getElementById('exportResultsBtn');
    if (exportResultsBtn) {
        exportResultsBtn.addEventListener('click', exportResults);
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // ===== رفع صورة السؤال من الجهاز =====
    const questionImageFile = document.getElementById('questionImageFile');
    if (questionImageFile) {
        questionImageFile.addEventListener('change', handleQuestionImageUpload);
    }
}

// رفع صورة السؤال من الجهاز إلى Supabase Storage
async function handleQuestionImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('questionImageStatus');
    const urlInput = document.getElementById('questionImageUrl');

    if (!file.type.startsWith('image/')) {
        showToast('error', 'الرجاء اختيار ملف صورة');
        e.target.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'حجم الصورة كبير جداً (الحد الأقصى 5MB)');
        e.target.value = '';
        return;
    }

    statusEl.innerHTML = '<span class="upload-spinner"></span> جاري رفع الصورة...';
    e.target.disabled = true;

    try {
        const url = await uploadImageToStorage(file);
        urlInput.value = url;
        statusEl.innerHTML = '<span style="color: #059669;">✅ تم رفع الصورة بنجاح</span>';
        updateQuestionImagePreview();
        showToast('success', 'تم رفع الصورة');
    } catch (error) {
        console.error('Upload error:', error);
        statusEl.innerHTML = `<span style="color: #dc2626;">❌ ${error.message || 'فشل الرفع'}</span>`;
        showToast('error', 'فشل رفع الصورة: ' + (error.message || 'خطأ غير معروف'));
        e.target.value = '';
    } finally {
        e.target.disabled = false;
    }
}

async function uploadImageToStorage(file) {
    if (!db) throw new Error('قاعدة البيانات غير متصلة');

    const ext = file.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `questions/${timestamp}_${random}.${ext}`;

    const { data, error } = await db.storage
        .from('quiz-images')
        .upload(filename, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (error) {
        if (error.message && error.message.toLowerCase().includes('bucket')) {
            throw new Error('Bucket "quiz-images" غير موجود في Supabase Storage');
        }
        throw error;
    }

    const { data: publicUrlData } = db.storage
        .from('quiz-images')
        .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
}

function updateQuestionImagePreview() {
    const url = document.getElementById('questionImageUrl')?.value.trim();
    const preview = document.getElementById('questionImagePreview');
    if (!preview) return;

    if (!url) {
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = `
        <img src="${escapeHtml(url)}" alt="معاينة" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="color: #dc2626; font-size: 0.85rem; display: none;">⚠️ تعذر تحميل الصورة</div>
        <span class="remove-image" onclick="clearQuestionImage()">🗑️ إزالة الصورة</span>
    `;
}

window.clearQuestionImage = function() {
    document.getElementById('questionImageUrl').value = '';
    document.getElementById('questionImageFile').value = '';
    document.getElementById('questionImageStatus').textContent = '';
    document.getElementById('questionImagePreview').innerHTML = '';
};
async function handleStudentsFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showToast('error', 'يرجى رفع ملف Excel (.xlsx أو .xls)');
        return;
    }

    try {
        const data = await readExcelFile(file);

        if (data.length === 0) {
            showToast('error', 'الملف فارغ');
            return;
        }

        // Parse rows - expect columns: student_number, student_name (optional), class_section
        const students = [];
        for (const row of data) {
            const keys = Object.keys(row);
            // Try to find columns by common Arabic/English names
            const numKey = keys.find(k => /رقم|number|id/i.test(k));
            const nameKey = keys.find(k => /اسم|name/i.test(k));
            const classKey = keys.find(k => /شعبة|class|section/i.test(k));

            const number = numKey ? String(row[numKey] || '').trim() : '';
            const name = nameKey ? String(row[nameKey] || '').trim() : null;
            const section = classKey ? String(row[classKey] || '').trim() : '';

            if (number && section) {
                students.push({
                    student_number: number,
                    student_name: name || null,
                    class_section: section
                });
            }
        }

        if (students.length === 0) {
            showToast('error', 'لم يتم العثور على بيانات صالحة. تأكد من وجود أعمدة: الرقم، الاسم، الشعبة');
            return;
        }

        if (!confirm(`سيتم إضافة/تحديث ${students.length} طالب. هل تريد المتابعة؟`)) {
            return;
        }

        // Upsert students
        const { error } = await db
            .from('students')
            .upsert(students, { onConflict: 'student_number' });

        if (error) throw error;

        showToast('success', `✅ تم رفع ${students.length} طالب بنجاح`);
        loadStudents();
    } catch (error) {
        console.error('Excel upload error:', error);
        showToast('error', 'فشل قراءة الملف: ' + error.message);
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        reader.readAsArrayBuffer(file);
    });
}

function downloadStudentsTemplate() {
    const data = [
        { 'الرقم الخاص': '1001', 'اسم الطالب': 'محمد أحمد', 'الشعبة الصفية': '6/1' },
        { 'الرقم الخاص': '1002', 'اسم الطالب': 'علي خالد', 'الشعبة الصفية': '6/2' },
        { 'الرقم الخاص': '1003', 'اسم الطالب': 'يوسف عمر', 'الشعبة الصفية': '6/3' }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
    XLSX.writeFile(wb, 'students_template.xlsx');
    showToast('success', '📥 تم تحميل القالب');
}

// ===== Student Modal =====
function openStudentModal(student = null) {
    editingStudentId = student ? student.id : null;
    document.getElementById('studentModalTitle').textContent = student ? 'تعديل طالب' : 'إضافة طالب جديد';
    document.getElementById('studentNumberInput').value = student ? student.student_number : '';
    document.getElementById('studentNameInput').value = student ? (student.student_name || '') : '';
    document.getElementById('studentClassInput').value = student ? student.class_section : '';
    document.getElementById('studentModal').classList.add('active');
}

window.editStudent = function(id) {
    const student = allStudents.find(s => s.id === id);
    if (student) openStudentModal(student);
};

window.deleteStudent = async function(id, number) {
    if (!confirm(`هل أنت متأكد من حذف الطالب رقم ${number}؟`)) return;

    try {
        const { error } = await db.from('students').delete().eq('id', id);
        if (error) throw error;
        showToast('success', '✅ تم حذف الطالب');
        loadStudents();
    } catch (error) {
        showToast('error', 'فشل الحذف: ' + error.message);
    }
};

async function saveStudent(e) {
    e.preventDefault();
    const number = document.getElementById('studentNumberInput').value.trim();
    const name = document.getElementById('studentNameInput').value.trim();
    const section = document.getElementById('studentClassInput').value.trim();

    if (!number || !section) {
        showToast('error', 'الرقم والشعبة مطلوبان');
        return;
    }

    try {
        const studentData = {
            student_number: number,
            student_name: name || null,
            class_section: section
        };

        if (editingStudentId) {
            const { error } = await db
                .from('students')
                .update(studentData)
                .eq('id', editingStudentId);
            if (error) throw error;
            showToast('success', '✅ تم التحديث');
        } else {
            const { error } = await db.from('students').insert(studentData);
            if (error) throw error;
            showToast('success', '✅ تم إضافة الطالب');
        }

        closeModal('studentModal');
        loadStudents();
    } catch (error) {
        showToast('error', 'فشل الحفظ: ' + error.message);
    }
}

// ===== Days Management =====
async function loadDays() {
    const grid = document.getElementById('daysGrid');
    grid.innerHTML = '<p class="loading-row">⏳ جاري التحميل...</p>';

    try {
        const { data, error } = await db
            .from('competition_days')
            .select('*, questions(count)')
            .order('day_number', { ascending: true });

        if (error) throw error;

        allDays = data || [];
        renderDays(allDays);

        // Update day filters elsewhere
        updateDayFilters();
    } catch (error) {
        console.error('Load days error:', error);
        grid.innerHTML = '<p class="loading-row">❌ فشل التحميل</p>';
    }
}

function renderDays(days) {
    const grid = document.getElementById('daysGrid');

    if (days.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <h3>لا توجد أيام مسابقة</h3>
                <p>قم بإضافة يوم جديد للبدء</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = days.map(d => {
        const questionsCount = d.questions?.[0]?.count || 0;
        return `
            <div class="day-card ${d.is_active ? 'active' : ''}">
                <div class="day-card-header">
                    <h4>${escapeHtml(d.day_name)}</h4>
                    <span class="day-status-badge ${d.is_active ? 'active' : 'inactive'}">
                        ${d.is_active ? '🟢 نشط' : '⚪ غير نشط'}
                    </span>
                </div>
                <div class="day-card-date">
                    📅 ${d.day_date || 'بدون تاريخ'}
                </div>
                <div class="day-card-stats">
                    <span>📝 ${questionsCount} سؤال</span>
                    <span>#${d.day_number}</span>
                </div>
                <div class="day-card-actions">
                    ${d.is_active
                        ? `<button class="btn btn-outline btn-sm" onclick="toggleDay('${d.id}', false)">إلغاء التفعيل</button>`
                        : `<button class="btn btn-primary btn-sm" onclick="toggleDay('${d.id}', true)">تفعيل</button>`
                    }
                    <button class="btn-icon danger" onclick="deleteDay('${d.id}', '${escapeHtml(d.day_name)}')" title="حذف">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openDayModal() {
    document.getElementById('dayNumberInput').value = allDays.length + 1;
    document.getElementById('dayNameInput').value = `اليوم ${allDays.length + 1}`;
    document.getElementById('dayDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('dayModal').classList.add('active');
}

async function saveDay(e) {
    e.preventDefault();
    const dayNumber = parseInt(document.getElementById('dayNumberInput').value);
    const dayName = document.getElementById('dayNameInput').value.trim();
    const dayDate = document.getElementById('dayDateInput').value;

    if (!dayName) {
        showToast('error', 'اسم اليوم مطلوب');
        return;
    }

    try {
        const { error } = await db.from('competition_days').insert({
            day_number: dayNumber,
            day_name: dayName,
            day_date: dayDate || null,
            is_active: false
        });

        if (error) throw error;
        showToast('success', '✅ تم إضافة اليوم');
        closeModal('dayModal');
        loadDays();
    } catch (error) {
        showToast('error', 'فشل الإضافة: ' + error.message);
    }
}

window.toggleDay = async function(id, activate) {
    try {
        if (activate) {
            // Deactivate all other days first
            await db.from('competition_days').update({ is_active: false }).neq('id', id);
        }

        const { error } = await db
            .from('competition_days')
            .update({ is_active: activate })
            .eq('id', id);

        if (error) throw error;
        showToast('success', activate ? '✅ تم تفعيل اليوم' : '✅ تم إلغاء التفعيل');
        loadDays();
    } catch (error) {
        showToast('error', 'فشل: ' + error.message);
    }
};

window.deleteDay = async function(id, name) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟ سيتم حذف جميع الأسئلة المرتبطة!`)) return;

    try {
        const { error } = await db.from('competition_days').delete().eq('id', id);
        if (error) throw error;
        showToast('success', '✅ تم الحذف');
        loadDays();
    } catch (error) {
        showToast('error', 'فشل: ' + error.message);
    }
};

function updateDayFilters() {
    const selectors = ['questionFilterDay', 'questionDayInput', 'resultsFilterDay'];
    selectors.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        const hasAllOption = id.includes('Filter');
        sel.innerHTML = (hasAllOption ? '<option value="">جميع الأيام</option>' : '<option value="">-- اختر اليوم --</option>') +
            allDays.map(d => `<option value="${d.id}" ${d.is_active ? 'data-active="true"' : ''}>${escapeHtml(d.day_name)}${d.is_active ? ' 🟢' : ''}</option>`).join('');
        if (currentVal) sel.value = currentVal;
    });
}

// ===== Questions Management =====
async function loadQuestionsPage() {
    if (allDays.length === 0) {
        await loadDays();
    } else {
        updateDayFilters();
    }
    loadQuestions();
}

async function loadQuestions() {
    const list = document.getElementById('questionsList');
    list.innerHTML = '<p class="loading-row">⏳ جاري التحميل...</p>';

    try {
        const { data, error } = await db
            .from('questions')
            .select('*, competition_days(day_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allQuestions = data || [];
        renderQuestions(allQuestions);
    } catch (error) {
        console.error('Load questions error:', error);
        list.innerHTML = '<p class="loading-row">❌ فشل التحميل</p>';
    }
}

function renderQuestions(questions) {
    const list = document.getElementById('questionsList');

    if (questions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3>لا توجد أسئلة</h3>
                <p>قم برفع ملف Word أو إضافة سؤال يدوياً</p>
            </div>
        `;
        return;
    }

    const subjectNames = {
        math: 'الرياضيات',
        science: 'العلوم',
        arabic: 'اللغة العربية',
        english: 'اللغة الإنجليزية',
        islamic: 'التربية الإسلامية',
        social: 'الاجتماعيات'
    };

    list.innerHTML = questions.map((q, i) => `
        <div class="question-list-item">
            <div class="question-list-number">${i + 1}</div>
            <div class="question-list-content">
                <div class="question-list-text">${escapeHtml(q.question_text)}</div>
                <div class="question-list-meta">
                    <span>📚 ${subjectNames[q.subject] || q.subject}</span>
                    <span>📅 ${escapeHtml(q.competition_days?.day_name || '-')}</span>
                    <span>✅ الإجابة: ${q.correct_answer}</span>
                    ${q.image_url ? '<span>🖼️ يحتوي صورة</span>' : ''}
                </div>
            </div>
            <div class="question-list-actions">
                <button class="btn-icon" onclick="editQuestion('${q.id}')" title="تعديل">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="btn-icon danger" onclick="deleteQuestion('${q.id}')" title="حذف">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function filterQuestions() {
    const dayFilter = document.getElementById('questionFilterDay').value;
    const subjectFilter = document.getElementById('questionFilterSubject').value;

    let filtered = allQuestions;
    if (dayFilter) filtered = filtered.filter(q => q.day_id === dayFilter);
    if (subjectFilter) filtered = filtered.filter(q => q.subject === subjectFilter);

    renderQuestions(filtered);
}

async function handleQuestionsFile(file) {
    if (!file.name.match(/\.docx$/i)) {
        showToast('error', 'يرجى رفع ملف Word (.docx)');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;

        const parsedQuestions = parseQuestionsFromText(text);

        if (parsedQuestions.length === 0) {
            showToast('error', 'لم يتم العثور على أسئلة. تأكد من تنسيق الملف.');
            return;
        }

        showToast('success', `✅ تم استخراج ${parsedQuestions.length} سؤال. يرجى مراجعة كل سؤال وحفظه`);

        // Show first question in modal for review/saving
        pendingQuestionsUpload = parsedQuestions;
        showImportPreview(parsedQuestions);
    } catch (error) {
        console.error('Word parsing error:', error);
        showToast('error', 'فشل قراءة الملف: ' + error.message);
    }
}

function parseQuestionsFromText(text) {
    const questions = [];
    // Split by question markers
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    let current = null;
    for (const line of lines) {
        // Question line
        if (/^(السؤال|سؤال)\s*[:：]/i.test(line) || /^\d+[\.\)]\s*/.test(line)) {
            if (current && current.options.length === 4) {
                questions.push(current);
            }
            current = {
                question_text: line.replace(/^(السؤال|سؤال)\s*[:：]\s*/i, '').replace(/^\d+[\.\)]\s*/, '').trim(),
                options: [],
                correct_answer: null
            };
        } else if (current) {
            // Option A
            const matchA = line.match(/^[أ١aA][\)\.\:،\s]\s*(.+)/);
            const matchB = line.match(/^[بB٢bB][\)\.\:،\s]\s*(.+)/);
            const matchC = line.match(/^[جC٣cC][\)\.\:،\s]\s*(.+)/);
            const matchD = line.match(/^[دD٤dD][\)\.\:،\s]\s*(.+)/);
            const matchAnswer = line.match(/^(الإجابة|الجواب|answer)\s*[:：]\s*([أبجدABCD])/i);

            if (matchAnswer) {
                const ans = matchAnswer[2].toUpperCase();
                const map = { 'أ': 'A', 'ب': 'B', 'ج': 'C', 'د': 'D' };
                current.correct_answer = map[ans] || ans;
            } else if (matchA) current.options[0] = matchA[1].trim();
            else if (matchB) current.options[1] = matchB[1].trim();
            else if (matchC) current.options[2] = matchC[1].trim();
            else if (matchD) current.options[3] = matchD[1].trim();
            else if (!current.question_text) {
                current.question_text = line;
            } else if (current.options.length < 4) {
                // Fallback: take next 4 lines after question as options
                current.options.push(line);
            }
        }
    }
    if (current && current.options.length === 4) {
        questions.push(current);
    }

    return questions.filter(q => q.question_text && q.options.length === 4);
}

function showImportPreview(questions) {
    // Open the question modal with the first imported question
    if (questions.length === 0) return;
    openQuestionModal(null, questions[0], questions);
}

// ===== Question Modal =====
let importQueue = null;
let importIndex = 0;

function openQuestionModal(question = null, importData = null, importList = null) {
    editingQuestionId = question ? question.id : null;
    importQueue = importList;
    importIndex = importList ? importList.indexOf(importData) : 0;

    document.getElementById('questionModalTitle').textContent =
        importData ? `استيراد سؤال (${importIndex + 1}/${importList.length})` :
        question ? 'تعديل السؤال' : 'إضافة سؤال جديد';

    const data = importData || question || {};

    document.getElementById('questionTextInput').value = data.question_text || '';
    document.getElementById('questionOptionA').value = (data.options ? data.options[0] : data.option_a) || '';
    document.getElementById('questionOptionB').value = (data.options ? data.options[1] : data.option_b) || '';
    document.getElementById('questionOptionC').value = (data.options ? data.options[2] : data.option_c) || '';
    document.getElementById('questionOptionD').value = (data.options ? data.options[3] : data.option_d) || '';
    document.getElementById('questionCorrectAnswer').value = data.correct_answer || '';
    document.getElementById('questionSubjectInput').value = data.subject || '';
    document.getElementById('questionImageUrl').value = data.image_url || '';
    // إعادة تعيين حقل الرفع + إظهار المعاينة
    const _fileInput = document.getElementById('questionImageFile');
    if (_fileInput) _fileInput.value = '';
    const _statusEl = document.getElementById('questionImageStatus');
    if (_statusEl) _statusEl.textContent = '';
    updateQuestionImagePreview();

    document.getElementById('questionDayInput').value = data.day_id || '';

    // Show import navigation if applicable
    const importNav = document.getElementById('importNav');
    if (importNav) {
        importNav.style.display = importList ? 'flex' : 'none';
        if (importList) {
            document.getElementById('importCounter').textContent = `${importIndex + 1} / ${importList.length}`;
        }
    }

    document.getElementById('questionModal').classList.add('active');
}

window.editQuestion = function(id) {
    const question = allQuestions.find(q => q.id === id);
    if (question) openQuestionModal(question);
};

window.deleteQuestion = async function(id) {
    if (!confirm('هل أنت متأكد من حذف السؤال؟')) return;

    try {
        const { error } = await db.from('questions').delete().eq('id', id);
        if (error) throw error;
        showToast('success', '✅ تم الحذف');
        loadQuestions();
    } catch (error) {
        showToast('error', 'فشل: ' + error.message);
    }
};

async function saveQuestion(e) {
    e.preventDefault();

    const questionData = {
        question_text: document.getElementById('questionTextInput').value.trim(),
        option_a: document.getElementById('questionOptionA').value.trim(),
        option_b: document.getElementById('questionOptionB').value.trim(),
        option_c: document.getElementById('questionOptionC').value.trim(),
        option_d: document.getElementById('questionOptionD').value.trim(),
        correct_answer: document.getElementById('questionCorrectAnswer').value,
        subject: document.getElementById('questionSubjectInput').value,
        image_url: document.getElementById('questionImageUrl').value.trim() || null,
        day_id: document.getElementById('questionDayInput').value
    };

    if (!questionData.question_text || !questionData.option_a || !questionData.option_b ||
        !questionData.option_c || !questionData.option_d || !questionData.correct_answer ||
        !questionData.subject || !questionData.day_id) {
        showToast('error', 'جميع الحقول مطلوبة (ما عدا رابط الصورة)');
        return;
    }

    try {
        if (editingQuestionId) {
            const { error } = await db
                .from('questions')
                .update(questionData)
                .eq('id', editingQuestionId);
            if (error) throw error;
            showToast('success', '✅ تم التحديث');
            closeModal('questionModal');
            loadQuestions();
        } else {
            const { error } = await db.from('questions').insert(questionData);
            if (error) throw error;
            showToast('success', '✅ تم الحفظ');

            // If importing, move to next
            if (importQueue && importIndex < importQueue.length - 1) {
                importIndex++;
                const nextQ = importQueue[importIndex];
                openQuestionModal(null, nextQ, importQueue);
            } else {
                closeModal('questionModal');
                importQueue = null;
                loadQuestions();
            }
        }
    } catch (error) {
        showToast('error', 'فشل الحفظ: ' + error.message);
    }
}

window.skipImportQuestion = function() {
    if (importQueue && importIndex < importQueue.length - 1) {
        importIndex++;
        const nextQ = importQueue[importIndex];
        openQuestionModal(null, nextQ, importQueue);
    } else {
        closeModal('questionModal');
        importQueue = null;
        loadQuestions();
    }
};

// ===== Results Page =====
async function loadResultsPage() {
    if (allDays.length === 0) {
        await loadDays();
    } else {
        updateDayFilters();
    }
    loadResultsData();
}

async function loadResultsData() {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">⏳ جاري التحميل...</td></tr>';

    const dayFilter = document.getElementById('resultsFilterDay').value;

    try {
        let query = db
            .from('quiz_sessions')
            .select(`
                *,
                students(student_number, student_name, class_section),
                competition_days(day_name)
            `)
            .eq('is_completed', true)
            .order('total_score', { ascending: false });

        if (dayFilter) query = query.eq('day_id', dayFilter);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">
                <div class="empty-state">
                    <h3>لا توجد نتائج بعد</h3>
                </div>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(s.students?.student_number || '-')}</strong></td>
                <td>${escapeHtml(s.students?.student_name || '-')}</td>
                <td><span class="status-badge">${escapeHtml(s.students?.class_section || '-')}</span></td>
                <td>${escapeHtml(s.competition_days?.day_name || '-')}</td>
                <td><strong style="color: var(--primary)">${s.total_score}</strong></td>
                <td>${s.correct_count} ✓ / ${s.wrong_count} ✗</td>
            </tr>
        `).join('');

        // Store for export
        window._currentResults = data;
    } catch (error) {
        console.error('Load results error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">❌ فشل التحميل</td></tr>';
    }
}

function exportResults() {
    if (!window._currentResults || window._currentResults.length === 0) {
        showToast('warning', 'لا توجد نتائج لتصديرها');
        return;
    }

    const data = window._currentResults.map((s, i) => ({
        'الترتيب': i + 1,
        'الرقم الخاص': s.students?.student_number || '-',
        'الاسم': s.students?.student_name || '-',
        'الشعبة': s.students?.class_section || '-',
        'اليوم': s.competition_days?.day_name || '-',
        'النتيجة': s.total_score,
        'إجابات صحيحة': s.correct_count,
        'إجابات خاطئة': s.wrong_count,
        'الوقت (ثانية)': s.total_time_seconds || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'النتائج');
    XLSX.writeFile(wb, `results_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('success', '📥 تم تصدير النتائج');
}

// ===== Modals =====
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
    importQueue = null;
};

// ===== Helpers =====
function showToast(type, message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.className = `toast ${type}`;
    document.getElementById('toastMessage').textContent = message;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };
    document.querySelector('.toast-icon').textContent = icons[type] || 'ℹ';

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}
