// ============================================
// صفحة الدخول - Login Page JavaScript
// ============================================

(function() {
    'use strict';

    let supabaseClient = null;
    let currentStudent = null;
    let verifyTimeout = null;

    // عناصر الواجهة
    const loginForm = document.getElementById('loginForm');
    const studentInput = document.getElementById('studentNumber');
    const loginButton = document.getElementById('loginButton');
    const studentInfo = document.getElementById('studentInfo');
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const studentClassDisplay = document.getElementById('studentClassDisplay');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // التهيئة عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', () => {
        supabaseClient = initSupabase();
        
        if (!supabaseClient) {
            showError('فشل الاتصال بقاعدة البيانات. يرجى التحقق من الإعدادات.');
            loginButton.disabled = true;
            return;
        }

        // التحقق من وجود جلسة سابقة
        const savedStudent = sessionStorage.getItem('currentStudent');
        if (savedStudent) {
            try {
                currentStudent = JSON.parse(savedStudent);
                studentInput.value = currentStudent.student_number;
                displayStudentInfo(currentStudent);
            } catch (e) {
                sessionStorage.removeItem('currentStudent');
            }
        }

        // الاستماع للأحداث
        attachEventListeners();
    });

    function attachEventListeners() {
        // التحقق التلقائي عند إدخال الرقم
        studentInput.addEventListener('input', handleInputChange);
        
        // إرسال النموذج
        loginForm.addEventListener('submit', handleSubmit);
    }

    function handleInputChange(e) {
        const value = e.target.value.trim();
        
        // إخفاء معلومات الطالب والأخطاء
        hideError();
        if (value.length === 0) {
            hideStudentInfo();
            currentStudent = null;
            return;
        }

        // إلغاء التحقق السابق
        if (verifyTimeout) {
            clearTimeout(verifyTimeout);
        }

        // تأخير قبل التحقق (لمنع طلبات كثيرة)
        if (value.length >= 3) {
            verifyTimeout = setTimeout(() => {
                verifyStudent(value);
            }, 500);
        }
    }

    async function verifyStudent(studentNumber) {
        try {
            const { data, error } = await supabaseClient
                .from('students')
                .select('*')
                .eq('student_number', studentNumber)
                .single();

            if (error || !data) {
                hideStudentInfo();
                currentStudent = null;
                return;
            }

            currentStudent = data;
            displayStudentInfo(data);
        } catch (err) {
            console.error('خطأ في التحقق من الطالب:', err);
            hideStudentInfo();
            currentStudent = null;
        }
    }

    function displayStudentInfo(student) {
        studentNameDisplay.textContent = student.student_name || 'طالب';
        studentClassDisplay.textContent = student.class_section;
        studentInfo.classList.remove('hidden');
    }

    function hideStudentInfo() {
        studentInfo.classList.add('hidden');
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        studentInput.classList.add('error');
        
        // اهتزاز
        studentInput.style.animation = 'shake 0.4s ease';
        setTimeout(() => {
            studentInput.style.animation = '';
        }, 400);
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        studentInput.classList.remove('error');
    }

    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        hideError();

        const studentNumber = studentInput.value.trim();
        
        if (!studentNumber) {
            showError('يرجى إدخال الرقم الخاص بك');
            return;
        }

        showLoading();

        try {
            // التحقق من الطالب
            const { data: student, error: studentError } = await supabaseClient
                .from('students')
                .select('*')
                .eq('student_number', studentNumber)
                .single();

            if (studentError || !student) {
                hideLoading();
                showError('الرقم الخاص غير صحيح. يرجى التحقق والمحاولة مرة أخرى.');
                return;
            }

            // التحقق من اليوم الفعال
            const { data: activeDay, error: dayError } = await supabaseClient
                .from('competition_days')
                .select('*')
                .eq('is_active', true)
                .order('day_date', { ascending: false })
                .limit(1)
                .single();

            if (dayError || !activeDay) {
                hideLoading();
                showError('لا توجد مسابقة مفعّلة حالياً. تواصل مع المعلم.');
                return;
            }

            // التحقق من عدم اللعب اليوم سابقاً
            const { data: existingSession } = await supabaseClient
                .from('quiz_sessions')
                .select('*')
                .eq('student_id', student.id)
                .eq('day_id', activeDay.id)
                .eq('is_completed', true)
                .maybeSingle();

            if (existingSession) {
                hideLoading();
                showError('لقد قمت بإكمال مسابقة اليوم سابقاً. عد غداً!');
                return;
            }

            // التحقق من وجود أسئلة لليوم
            const { data: questions, error: qError, count } = await supabaseClient
                .from('questions')
                .select('id', { count: 'exact', head: true })
                .eq('day_id', activeDay.id);

            if (qError || !count || count === 0) {
                hideLoading();
                showError('لم يتم إضافة أسئلة لليوم بعد. تواصل مع المعلم.');
                return;
            }

            // حفظ بيانات الطالب
            const sessionData = {
                ...student,
                day_id: activeDay.id,
                day_name: activeDay.day_name,
                day_number: activeDay.day_number,
                login_time: Date.now()
            };
            sessionStorage.setItem('currentStudent', JSON.stringify(sessionData));

            // الانتقال إلى صفحة المسابقة
            hideLoading();
            window.location.href = 'quiz.html';

        } catch (err) {
            hideLoading();
            console.error('خطأ في تسجيل الدخول:', err);
            showError('حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.');
        }
    }

})();
