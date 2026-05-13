// ============================================
// صفحة المسابقة - Quiz Page JavaScript
// ============================================

(function() {
    'use strict';

    // المتغيرات العامة
    let supabaseClient = null;
    let currentStudent = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let currentSession = null;
    let timer = null;
    let timeRemaining = 30;
    let selectedAnswer = null;
    let questionStartTime = null;
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let totalTimeSeconds = 0;
    let isAnswered = false;
    let savedAnswers = [];

    // معلومات المواد
    const SUBJECT_INFO = {
        math: { name: 'الرياضيات', icon: '📐', class: 'math' },
        science: { name: 'العلوم', icon: '🔬', class: 'science' },
        arabic: { name: 'اللغة العربية', icon: '📖', class: 'arabic' },
        english: { name: 'اللغة الإنجليزية', icon: '🇬🇧', class: 'english' },
        islamic: { name: 'التربية الإسلامية', icon: '🕌', class: 'islamic' },
        social: { name: 'الاجتماعيات', icon: '🌍', class: 'social' }
    };

    // عناصر الواجهة
    const elements = {
        studentNameBadge: document.getElementById('studentNameBadge'),
        studentClassBadge: document.getElementById('studentClassBadge'),
        currentQuestionNum: document.getElementById('currentQuestionNum'),
        totalQuestionsNum: document.getElementById('totalQuestionsNum'),
        currentScore: document.getElementById('currentScore'),
        progressBar: document.getElementById('progressBar'),
        timerCircle: document.getElementById('timerCircle'),
        timerProgress: document.getElementById('timerProgress'),
        timerNumber: document.getElementById('timerNumber'),
        subjectBadge: document.getElementById('subjectBadge'),
        subjectIcon: document.getElementById('subjectIcon'),
        subjectName: document.getElementById('subjectName'),
        questionImageContainer: document.getElementById('questionImageContainer'),
        questionImage: document.getElementById('questionImage'),
        questionText: document.getElementById('questionText'),
        questionCard: document.getElementById('questionCard'),
        optionsContainer: document.getElementById('optionsContainer'),
        nextButton: document.getElementById('nextButton'),
        feedbackOverlay: document.getElementById('feedbackOverlay'),
        feedbackCard: document.getElementById('feedbackCard'),
        feedbackIcon: document.getElementById('feedbackIcon'),
        feedbackTitle: document.getElementById('feedbackTitle'),
        feedbackPoints: document.getElementById('feedbackPoints'),
        loadingOverlay: document.getElementById('loadingOverlay')
    };

    // التهيئة
    document.addEventListener('DOMContentLoaded', init);

    // منع الرجوع
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
        history.pushState(null, '', location.href);
        alert('لا يمكنك الرجوع أثناء المسابقة!');
    });

    // تحذير عند المغادرة
    window.addEventListener('beforeunload', (e) => {
        if (currentQuestionIndex < questions.length && !isAnswered) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    async function init() {
        // التحقق من بيانات الطالب
        const studentData = sessionStorage.getItem('currentStudent');
        if (!studentData) {
            window.location.href = 'index.html';
            return;
        }

        try {
            currentStudent = JSON.parse(studentData);
        } catch (e) {
            window.location.href = 'index.html';
            return;
        }

        // عرض بيانات الطالب
        elements.studentNameBadge.textContent = currentStudent.student_name || 'الطالب';
        elements.studentClassBadge.textContent = currentStudent.class_section;

        // تهيئة Supabase
        supabaseClient = initSupabase();
        if (!supabaseClient) {
            alert('فشل الاتصال بقاعدة البيانات');
            return;
        }

        // ربط أحداث الخيارات
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => handleAnswerSelect(btn.dataset.option));
        });

        elements.nextButton.addEventListener('click', moveToNextQuestion);

        // تحميل الأسئلة
        await loadQuestions();
    }

    async function loadQuestions() {
        try {
            // جلب الأسئلة
            const { data, error } = await supabaseClient
                .from('questions')
                .select('*')
                .eq('day_id', currentStudent.day_id)
                .order('question_order', { ascending: true });

            if (error || !data || data.length === 0) {
                alert('لا توجد أسئلة لهذا اليوم!');
                window.location.href = 'index.html';
                return;
            }

            questions = data;
            elements.totalQuestionsNum.textContent = questions.length;

            // إنشاء جلسة جديدة
            const { data: session, error: sessionError } = await supabaseClient
                .from('quiz_sessions')
                .insert([{
                    student_id: currentStudent.id,
                    day_id: currentStudent.day_id,
                    started_at: new Date().toISOString(),
                    is_completed: false
                }])
                .select()
                .single();

            if (sessionError) {
                // قد توجد جلسة سابقة - حاول تحديثها
                const { data: existingSession } = await supabaseClient
                    .from('quiz_sessions')
                    .select('*')
                    .eq('student_id', currentStudent.id)
                    .eq('day_id', currentStudent.day_id)
                    .single();

                if (existingSession && existingSession.is_completed) {
                    alert('لقد أكملت المسابقة سابقاً!');
                    window.location.href = 'index.html';
                    return;
                }
                currentSession = existingSession;
            } else {
                currentSession = session;
            }

            // إخفاء شاشة التحميل وبدء الاختبار
            elements.loadingOverlay.classList.add('hidden');
            displayQuestion();

        } catch (err) {
            console.error('خطأ في تحميل الأسئلة:', err);
            alert('حدث خطأ في تحميل الأسئلة');
        }
    }

    function displayQuestion() {
        if (currentQuestionIndex >= questions.length) {
            finishQuiz();
            return;
        }

        const q = questions[currentQuestionIndex];
        isAnswered = false;
        selectedAnswer = null;
        questionStartTime = Date.now();

        // تحديث رقم السؤال
        elements.currentQuestionNum.textContent = currentQuestionIndex + 1;

        // تحديث شريط التقدم
        const progress = ((currentQuestionIndex) / questions.length) * 100;
        elements.progressBar.style.width = progress + '%';

        // عرض شارة المادة
        const subject = SUBJECT_INFO[q.subject] || SUBJECT_INFO.math;
        elements.subjectIcon.textContent = subject.icon;
        elements.subjectName.textContent = subject.name;
        elements.subjectBadge.className = 'subject-badge ' + subject.class;

        // عرض الصورة
        if (q.image_url && q.image_url.trim()) {
            elements.questionImage.src = q.image_url;
            elements.questionImageContainer.classList.remove('empty');
        } else {
            elements.questionImageContainer.classList.add('empty');
        }

        // عرض السؤال والخيارات
        elements.questionText.textContent = q.question_text;
        document.getElementById('optionA').textContent = q.option_a;
        document.getElementById('optionB').textContent = q.option_b;
        document.getElementById('optionC').textContent = q.option_c;
        document.getElementById('optionD').textContent = q.option_d;

        // إعادة تعيين الخيارات
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected', 'correct', 'wrong');
            btn.disabled = false;
        });

        elements.nextButton.classList.add('hidden');

        // تشغيل الرسوم المتحركة
        elements.questionCard.style.animation = 'none';
        setTimeout(() => {
            elements.questionCard.style.animation = 'fadeInUp 0.5s ease';
        }, 10);

        // بدء المؤقت
        startTimer();
    }

    function startTimer() {
        timeRemaining = SUBABASE_CONFIG_TIME_OR_DEFAULT();
        updateTimerDisplay();
        elements.timerCircle.classList.remove('warning', 'danger');

        if (timer) clearInterval(timer);
        
        timer = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            if (timeRemaining <= 10 && timeRemaining > 5) {
                elements.timerCircle.classList.add('warning');
            } else if (timeRemaining <= 5) {
                elements.timerCircle.classList.remove('warning');
                elements.timerCircle.classList.add('danger');
            }

            if (timeRemaining <= 0) {
                clearInterval(timer);
                handleTimeOut();
            }
        }, 1000);
    }

    function SUBABASE_CONFIG_TIME_OR_DEFAULT() {
        try {
            return window.SUPABASE_CONFIG.TIME_PER_QUESTION || 30;
        } catch (e) {
            return 30;
        }
    }

    function updateTimerDisplay() {
        elements.timerNumber.textContent = timeRemaining;
        const totalTime = SUBABASE_CONFIG_TIME_OR_DEFAULT();
        const circumference = 339.292;
        const offset = circumference - (timeRemaining / totalTime) * circumference;
        elements.timerProgress.style.strokeDashoffset = offset;
    }

    async function handleAnswerSelect(option) {
        if (isAnswered) return;
        isAnswered = true;

        if (timer) clearInterval(timer);

        selectedAnswer = option;
        const q = questions[currentQuestionIndex];
        const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
        const isCorrect = option === q.correct_answer;

        // تعطيل جميع الخيارات
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.option === option) {
                btn.classList.add('selected');
            }
        });

        // عرض الإجابة الصحيحة بعد فترة قصيرة
        setTimeout(() => {
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.classList.remove('selected');
                if (btn.dataset.option === q.correct_answer) {
                    btn.classList.add('correct');
                } else if (btn.dataset.option === option && !isCorrect) {
                    btn.classList.add('wrong');
                }
            });
        }, 300);

        // حساب النقاط
        let points = 0;
        if (isCorrect) {
            const basePoints = 100;
            const maxBonus = 50;
            const totalTime = SUBABASE_CONFIG_TIME_OR_DEFAULT();
            const speedBonus = Math.max(0, Math.floor((totalTime - timeTaken) / totalTime * maxBonus));
            points = basePoints + speedBonus;
            totalScore += points;
            correctCount++;
        } else {
            wrongCount++;
        }

        totalTimeSeconds += timeTaken;

        // تحديث العرض
        elements.currentScore.textContent = totalScore;

        // حفظ الإجابة
        await saveAnswer(q.id, option, isCorrect, timeTaken, points);

        // عرض الفيدباك
        showFeedback(isCorrect, points, false);

        // إظهار زر التالي
        setTimeout(() => {
            elements.nextButton.classList.remove('hidden');
        }, 2000);
    }

    async function handleTimeOut() {
        if (isAnswered) return;
        isAnswered = true;

        const q = questions[currentQuestionIndex];
        const timeTaken = SUBABASE_CONFIG_TIME_OR_DEFAULT();

        // تعطيل الخيارات
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.option === q.correct_answer) {
                btn.classList.add('correct');
            }
        });

        wrongCount++;
        totalTimeSeconds += timeTaken;

        // حفظ الإجابة (خاطئة لانتهاء الوقت)
        await saveAnswer(q.id, null, false, timeTaken, 0);

        // عرض رسالة انتهاء الوقت
        showFeedback(false, 0, true);

        // الانتقال تلقائياً بعد 2.5 ثانية
        setTimeout(() => {
            moveToNextQuestion();
        }, 2500);
    }

    function showFeedback(isCorrect, points, isTimeout) {
        elements.feedbackCard.className = 'feedback-card';
        
        if (isTimeout) {
            elements.feedbackCard.classList.add('timeout');
            elements.feedbackIcon.textContent = '⏰';
            elements.feedbackTitle.textContent = 'انتهى الوقت!';
            elements.feedbackPoints.textContent = 'سيتم الانتقال للسؤال التالي';
        } else if (isCorrect) {
            elements.feedbackCard.classList.add('correct');
            elements.feedbackIcon.textContent = '✓';
            elements.feedbackTitle.textContent = 'إجابة صحيحة!';
            elements.feedbackPoints.textContent = `+${points} نقطة`;
        } else {
            elements.feedbackCard.classList.add('wrong');
            elements.feedbackIcon.textContent = '✗';
            elements.feedbackTitle.textContent = 'إجابة خاطئة';
            elements.feedbackPoints.textContent = '0 نقطة';
        }

        elements.feedbackOverlay.classList.remove('hidden');

        setTimeout(() => {
            elements.feedbackOverlay.classList.add('hidden');
        }, 1500);
    }

    async function saveAnswer(questionId, answer, isCorrect, timeTaken, points) {
        const answerData = {
            session_id: currentSession.id,
            question_id: questionId,
            student_answer: answer,
            is_correct: isCorrect,
            time_taken_seconds: timeTaken,
            points_earned: points
        };

        savedAnswers.push(answerData);

        try {
            await supabaseClient.from('answers').insert([answerData]);
        } catch (err) {
            console.error('خطأ في حفظ الإجابة:', err);
        }
    }

    function moveToNextQuestion() {
        elements.feedbackOverlay.classList.add('hidden');
        currentQuestionIndex++;
        displayQuestion();
    }

    async function finishQuiz() {
        // تحديث شريط التقدم إلى 100%
        elements.progressBar.style.width = '100%';

        // تحديث الجلسة
        try {
            await supabaseClient
                .from('quiz_sessions')
                .update({
                    finished_at: new Date().toISOString(),
                    total_score: totalScore,
                    correct_count: correctCount,
                    wrong_count: wrongCount,
                    total_time_seconds: totalTimeSeconds,
                    is_completed: true
                })
                .eq('id', currentSession.id);

            // حفظ بيانات النتائج للصفحة التالية
            const resultsData = {
                sessionId: currentSession.id,
                totalScore,
                correctCount,
                wrongCount,
                totalTimeSeconds,
                totalQuestions: questions.length,
                questions: questions.map((q, i) => {
                    const ans = savedAnswers[i];
                    return {
                        id: q.id,
                        question_text: q.question_text,
                        subject: q.subject,
                        option_a: q.option_a,
                        option_b: q.option_b,
                        option_c: q.option_c,
                        option_d: q.option_d,
                        correct_answer: q.correct_answer,
                        student_answer: ans ? ans.student_answer : null,
                        is_correct: ans ? ans.is_correct : false,
                        points_earned: ans ? ans.points_earned : 0
                    };
                })
            };

            sessionStorage.setItem('quizResults', JSON.stringify(resultsData));
            window.location.href = 'results.html';

        } catch (err) {
            console.error('خطأ في إنهاء المسابقة:', err);
            alert('حدث خطأ في حفظ النتائج');
        }
    }

})();
