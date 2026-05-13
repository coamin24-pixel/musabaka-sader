// ============================================
// لوحة الصدارة - Leaderboard JavaScript
// ============================================

(function() {
    'use strict';

    let supabaseClient = null;
    let currentTab = 'overall';
    let cachedData = {
        overall: null,
        daily: null,
        classes: null,
        stats: null
    };

    document.addEventListener('DOMContentLoaded', async () => {
        supabaseClient = initSupabase();
        if (!supabaseClient) {
            alert('فشل الاتصال بقاعدة البيانات');
            return;
        }

        // إعداد التبويبات
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // تحميل البيانات الأولية
        await loadOverall();
        document.getElementById('loadingOverlay').classList.add('hidden');
    });

    async function switchTab(tab) {
        currentTab = tab;

        // تحديث التبويبات
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // إخفاء جميع الأقسام
        document.getElementById('podium-section').classList.add('hidden');
        document.getElementById('rankings-section').classList.add('hidden');
        document.getElementById('classes-section').classList.add('hidden');
        document.getElementById('stats-section').classList.add('hidden');

        document.getElementById('loadingOverlay').classList.remove('hidden');

        try {
            switch (tab) {
                case 'overall':
                    await loadOverall();
                    break;
                case 'daily':
                    await loadDaily();
                    break;
                case 'classes':
                    await loadClasses();
                    break;
                case 'stats':
                    await loadStats();
                    break;
            }
        } catch (err) {
            console.error('خطأ:', err);
        }

        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    async function loadOverall() {
        document.getElementById('podium-section').classList.remove('hidden');
        document.getElementById('rankings-section').classList.remove('hidden');
        document.getElementById('rankingsTitle').textContent = 'المراكز من 4 إلى 10';

        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('*')
            .limit(10);

        if (error || !data || data.length === 0) {
            renderPodium([]);
            renderRankings([]);
            return;
        }

        renderPodium(data.slice(0, 3));
        renderRankings(data.slice(3, 10), 4);
    }

    async function loadDaily() {
        document.getElementById('podium-section').classList.remove('hidden');
        document.getElementById('rankings-section').classList.remove('hidden');
        document.getElementById('rankingsTitle').textContent = 'المراكز من 4 إلى 10 - اليوم النشط';

        // الحصول على اليوم النشط
        const { data: activeDay } = await supabaseClient
            .from('competition_days')
            .select('*')
            .eq('is_active', true)
            .order('day_date', { ascending: false })
            .limit(1)
            .single();

        if (!activeDay) {
            renderPodium([]);
            renderRankings([]);
            return;
        }

        const { data, error } = await supabaseClient
            .from('daily_leaderboard')
            .select('*')
            .eq('day_id', activeDay.id)
            .limit(10);

        if (error || !data || data.length === 0) {
            renderPodium([]);
            renderRankings([]);
            return;
        }

        const formatted = data.map(d => ({
            student_id: d.student_id,
            student_number: d.student_number,
            student_name: d.student_name,
            class_section: d.class_section,
            total_score: d.total_score,
            total_correct: d.correct_count,
            total_time: d.total_time_seconds,
            days_played: 1
        }));

        renderPodium(formatted.slice(0, 3));
        renderRankings(formatted.slice(3, 10), 4);
    }

    async function loadClasses() {
        document.getElementById('classes-section').classList.remove('hidden');

        const { data, error } = await supabaseClient
            .from('class_ranking')
            .select('*');

        if (error || !data) {
            return;
        }

        renderClasses(data);
    }

    async function loadStats() {
        document.getElementById('stats-section').classList.remove('hidden');

        // إجمالي الطلاب
        const { count: totalStudents } = await supabaseClient
            .from('students')
            .select('*', { count: 'exact', head: true });

        // الطلاب المشاركون
        const { data: participatedData } = await supabaseClient
            .from('quiz_sessions')
            .select('student_id', { count: 'exact' })
            .eq('is_completed', true);

        const participatedCount = participatedData 
            ? new Set(participatedData.map(s => s.student_id)).size 
            : 0;

        // متوسط النقاط
        const { data: leaderboardData } = await supabaseClient
            .from('leaderboard')
            .select('total_score');

        const validScores = leaderboardData ? leaderboardData.filter(d => d.total_score) : [];
        const avgScore = validScores.length > 0
            ? Math.round(validScores.reduce((sum, d) => sum + (d.total_score || 0), 0) / validScores.length)
            : 0;

        const participationRate = totalStudents > 0
            ? Math.round((participatedCount / totalStudents) * 100)
            : 0;

        animateNumber('totalStudents', totalStudents || 0);
        animateNumber('participatedStudents', participatedCount);
        animateNumber('participationRate', participationRate, '%');
        animateNumber('avgScore', avgScore);
    }

    function renderPodium(top3) {
        const positions = ['podium1', 'podium2', 'podium3'];
        
        positions.forEach((id, index) => {
            const item = top3[index];
            const podium = document.getElementById(id);
            
            if (item) {
                podium.querySelector('.podium-name').textContent = 
                    item.student_name || `طالب ${item.student_number}`;
                podium.querySelector('.podium-score').textContent = 
                    `${item.total_score || 0} نقطة`;
            } else {
                podium.querySelector('.podium-name').textContent = 'فارغ';
                podium.querySelector('.podium-score').textContent = '- نقطة';
            }
        });
    }

    function renderRankings(items, startRank = 4) {
        const container = document.getElementById('rankingsList');
        const emptyState = document.getElementById('emptyState');

        if (!items || items.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        container.innerHTML = items.map((item, index) => {
            const rank = startRank + index;
            const name = item.student_name || `طالب ${item.student_number}`;
            const score = item.total_score || 0;
            const className = item.class_section || '-';

            return `
                <div class="ranking-item" style="animation-delay: ${index * 0.05}s">
                    <div class="ranking-position">${rank}</div>
                    <div class="ranking-info">
                        <div class="ranking-name">${name}</div>
                        <div class="ranking-meta">
                            <span class="ranking-class-tag">${className}</span>
                            <span>${item.total_correct || 0} إجابة صحيحة</span>
                        </div>
                    </div>
                    <div>
                        <div class="ranking-score">${score}</div>
                        <span class="ranking-score-label">نقطة</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderClasses(classes) {
        const container = document.getElementById('classesList');

        if (!classes || classes.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 40px; color: var(--text-secondary);">لا توجد شعب لعرضها</p>';
            return;
        }

        container.innerHTML = classes.map((cls, index) => {
            const participationRate = cls.participation_rate || 0;
            const rank = index + 1;
            
            return `
                <div class="class-card" style="animation-delay: ${index * 0.1}s">
                    <div class="class-card-header">
                        <div class="class-name">${cls.class_section}</div>
                        <div class="class-rank-badge">${rank}</div>
                    </div>
                    <div class="class-stat">
                        <span class="class-stat-label">إجمالي النقاط</span>
                        <span class="class-stat-value" style="color: var(--accent-dark);">
                            ${Math.round(cls.total_score || 0)}
                        </span>
                    </div>
                    <div class="class-stat">
                        <span class="class-stat-label">عدد الطلاب</span>
                        <span class="class-stat-value">${cls.total_students || 0}</span>
                    </div>
                    <div class="class-stat">
                        <span class="class-stat-label">المشاركون</span>
                        <span class="class-stat-value" style="color: var(--success);">
                            ${cls.active_students || 0}
                        </span>
                    </div>
                    <div class="class-stat">
                        <span class="class-stat-label">متوسط النقاط</span>
                        <span class="class-stat-value">${Math.round(cls.average_score || 0)}</span>
                    </div>
                    <div style="margin-top: 12px;">
                        <div class="flex justify-between" style="margin-bottom: 6px;">
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">
                                نسبة التفاعل
                            </span>
                            <span style="font-weight: 700; color: var(--primary);">
                                ${participationRate}%
                            </span>
                        </div>
                        <div class="participation-bar">
                            <div class="participation-fill" style="width: ${participationRate}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function animateNumber(elementId, targetValue, suffix = '') {
        const element = document.getElementById(elementId);
        const duration = 1200;
        const startTime = Date.now();

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easeOut * targetValue);
            element.textContent = currentValue + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = targetValue + suffix;
            }
        }

        update();
    }

})();
