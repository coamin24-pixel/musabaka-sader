// ============================================
// صفحة النتائج - Results Page JavaScript
// ============================================

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const resultsData = sessionStorage.getItem('quizResults');
        const studentData = sessionStorage.getItem('currentStudent');

        if (!resultsData || !studentData) {
            window.location.href = 'index.html';
            return;
        }

        const results = JSON.parse(resultsData);
        const student = JSON.parse(studentData);

        // عرض اسم الطالب والشعبة
        document.getElementById('resultStudentName').textContent = student.student_name || 'الطالب';
        document.getElementById('resultStudentClass').textContent = student.class_section;

        // الإحصائيات
        document.getElementById('correctCount').textContent = results.correctCount;
        document.getElementById('wrongCount').textContent = results.wrongCount;
        
        // تنسيق الوقت
        const minutes = Math.floor(results.totalTimeSeconds / 60);
        const seconds = results.totalTimeSeconds % 60;
        document.getElementById('totalTime').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // نسبة الدقة
        const accuracy = results.totalQuestions > 0 
            ? Math.round((results.correctCount / results.totalQuestions) * 100) 
            : 0;
        document.getElementById('accuracyPercent').textContent = accuracy + '%';

        // النتيجة النهائية مع animation
        animateScore(results.totalScore);

        // شريط النتيجة
        const maxPossibleScore = results.totalQuestions * 150; // 100 base + 50 bonus
        const scorePercent = Math.min(100, (results.totalScore / maxPossibleScore) * 100);
        setTimeout(() => {
            document.getElementById('scoreBarFill').style.width = scorePercent + '%';
        }, 500);

        // تغيير الترحيب بناءً على الأداء
        updateGreeting(accuracy);

        // عرض الإجابات
        renderAnswers(results.questions);

        // زر الإجابات
        const toggleBtn = document.getElementById('toggleAnswers');
        const answersContainer = document.getElementById('answersContainer');
        const toggleText = document.getElementById('toggleText');
        
        toggleBtn.addEventListener('click', () => {
            answersContainer.classList.toggle('hidden');
            toggleText.textContent = answersContainer.classList.contains('hidden') 
                ? 'عرض الإجابات' 
                : 'إخفاء الإجابات';
        });

        // مسح بيانات الجلسة بعد عرضها (لمنع التكرار)
        // sessionStorage.removeItem('quizResults'); // يبقى للحاجة
    });

    function animateScore(targetScore) {
        const scoreElement = document.getElementById('finalScore');
        const duration = 1500;
        const startTime = Date.now();

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easeOut * targetScore);
            scoreElement.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                scoreElement.textContent = targetScore;
            }
        }

        update();
    }

    function updateGreeting(accuracy) {
        const subtitleEl = document.getElementById('resultsSubtitle');
        const trophyEl = document.getElementById('trophyIcon');

        if (accuracy >= 90) {
            subtitleEl.textContent = '🌟 أداء استثنائي! أنت بطل حقيقي!';
            trophyEl.textContent = '🏆';
        } else if (accuracy >= 75) {
            subtitleEl.textContent = '✨ أداء ممتاز! استمر في التألق!';
            trophyEl.textContent = '🥇';
        } else if (accuracy >= 60) {
            subtitleEl.textContent = '👍 أداء جيد جداً! يمكنك التحسن أكثر!';
            trophyEl.textContent = '🥈';
        } else if (accuracy >= 40) {
            subtitleEl.textContent = '💪 أداء جيد، تابع المراجعة لتتقدم!';
            trophyEl.textContent = '🥉';
        } else {
            subtitleEl.textContent = '📚 لا تستسلم، الجد والمثابرة طريق النجاح!';
            trophyEl.textContent = '🌱';
        }
    }

    function renderAnswers(questions) {
        const container = document.getElementById('answersContainer');
        const SUBJECTS = {
            math: 'الرياضيات', science: 'العلوم', arabic: 'اللغة العربية',
            english: 'اللغة الإنجليزية', islamic: 'التربية الإسلامية', social: 'الاجتماعيات'
        };
        const LETTERS = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

        container.innerHTML = questions.map((q, index) => {
            const isCorrect = q.is_correct;
            const isSkipped = !q.student_answer;
            const statusClass = isCorrect ? 'correct' : (isSkipped ? 'skipped' : 'wrong');
            const statusText = isCorrect ? 'صحيحة' : (isSkipped ? 'لم تجب' : 'خاطئة');
            const statusIcon = isCorrect ? '✓' : (isSkipped ? '⏰' : '✗');

            const options = [
                { letter: 'A', text: q.option_a },
                { letter: 'B', text: q.option_b },
                { letter: 'C', text: q.option_c },
                { letter: 'D', text: q.option_d }
            ];

            return `
                <div class="answer-item ${isCorrect ? '' : (isSkipped ? 'skipped' : 'wrong')}">
                    <div class="answer-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="answer-number">${index + 1}</div>
                            <span style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 700;">
                                ${SUBJECTS[q.subject] || ''}
                            </span>
                        </div>
                        <div class="answer-status ${isCorrect ? 'correct' : 'wrong'}">
                            <span>${statusIcon}</span>
                            <span>${statusText}</span>
                            ${isCorrect ? `<span>+${q.points_earned}</span>` : ''}
                        </div>
                    </div>
                    <div class="answer-question">${q.question_text}</div>
                    <div class="answer-options">
                        ${options.map(opt => {
                            let optClass = '';
                            if (opt.letter === q.correct_answer) {
                                optClass = 'correct-answer';
                            } else if (opt.letter === q.student_answer && !isCorrect) {
                                optClass = 'student-answer-wrong';
                            }
                            return `
                                <div class="answer-option ${optClass}">
                                    <span class="answer-option-letter">${LETTERS[opt.letter]}</span>
                                    <span>${opt.text}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

})();
