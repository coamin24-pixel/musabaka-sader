-- ============================================
-- المسابقة الثقافية للصف السادس
-- مدرسة الزبير بن العوام الابتدائية للبنين
-- Supabase Database Schema
-- ============================================

-- 1. جدول الطلاب
CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    student_number VARCHAR(50) UNIQUE NOT NULL,
    student_name VARCHAR(200),
    class_section VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. جدول أيام المسابقة
CREATE TABLE IF NOT EXISTS competition_days (
    id BIGSERIAL PRIMARY KEY,
    day_number INTEGER UNIQUE NOT NULL,
    day_name VARCHAR(100) NOT NULL,
    day_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. جدول الأسئلة
CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    day_id BIGINT REFERENCES competition_days(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL, -- math, science, arabic, english, islamic, social
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    image_url TEXT,
    question_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. جدول جلسات الاختبار
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
    day_id BIGINT REFERENCES competition_days(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    total_score INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    UNIQUE(student_id, day_id)
);

-- 5. جدول الإجابات
CREATE TABLE IF NOT EXISTS answers (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    student_answer CHAR(1),
    is_correct BOOLEAN DEFAULT false,
    time_taken_seconds INTEGER DEFAULT 30,
    points_earned INTEGER DEFAULT 0,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. جدول لوحة الصدارة (View محسوب)
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    s.id as student_id,
    s.student_number,
    s.student_name,
    s.class_section,
    SUM(qs.total_score) as total_score,
    SUM(qs.correct_count) as total_correct,
    SUM(qs.total_time_seconds) as total_time,
    COUNT(qs.id) as days_played
FROM students s
LEFT JOIN quiz_sessions qs ON s.id = qs.student_id AND qs.is_completed = true
GROUP BY s.id, s.student_number, s.student_name, s.class_section
ORDER BY total_score DESC NULLS LAST, total_time ASC;

-- 7. View للصدارة اليومية
CREATE OR REPLACE VIEW daily_leaderboard AS
SELECT 
    s.id as student_id,
    s.student_number,
    s.student_name,
    s.class_section,
    qs.day_id,
    qs.total_score,
    qs.correct_count,
    qs.wrong_count,
    qs.total_time_seconds
FROM students s
INNER JOIN quiz_sessions qs ON s.id = qs.student_id
WHERE qs.is_completed = true
ORDER BY qs.day_id, qs.total_score DESC, qs.total_time_seconds ASC;

-- 8. View لترتيب الشعب
CREATE OR REPLACE VIEW class_ranking AS
SELECT 
    s.class_section,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(DISTINCT qs.student_id) as active_students,
    COALESCE(SUM(qs.total_score), 0) as total_score,
    COALESCE(AVG(qs.total_score), 0) as average_score,
    ROUND((COUNT(DISTINCT qs.student_id)::DECIMAL / NULLIF(COUNT(DISTINCT s.id), 0)) * 100, 2) as participation_rate
FROM students s
LEFT JOIN quiz_sessions qs ON s.id = qs.student_id AND qs.is_completed = true
GROUP BY s.class_section
ORDER BY total_score DESC;

-- ============================================
-- Indexes لتسريع الاستعلامات
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_questions_day ON questions(day_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON quiz_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON quiz_sessions(day_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_days ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة العامة (للموقع الأمامي)
CREATE POLICY "Public read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read days" ON competition_days FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON quiz_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sessions" ON quiz_sessions FOR UPDATE USING (true);
CREATE POLICY "Public read sessions" ON quiz_sessions FOR SELECT USING (true);
CREATE POLICY "Public insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read answers" ON answers FOR SELECT USING (true);

-- سياسات للوحة الإدارة (الكتابة)
-- ملاحظة: للإنتاج الفعلي، استخدم Service Role Key على الخادم
-- هذه السياسات تسمح بالكتابة من المتصفح للتبسيط
CREATE POLICY "Public insert students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update students" ON students FOR UPDATE USING (true);
CREATE POLICY "Public delete students" ON students FOR DELETE USING (true);

CREATE POLICY "Public insert questions" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update questions" ON questions FOR UPDATE USING (true);
CREATE POLICY "Public delete questions" ON questions FOR DELETE USING (true);

CREATE POLICY "Public insert days" ON competition_days FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update days" ON competition_days FOR UPDATE USING (true);
CREATE POLICY "Public delete days" ON competition_days FOR DELETE USING (true);

CREATE POLICY "Public delete sessions" ON quiz_sessions FOR DELETE USING (true);

-- ============================================
-- بيانات تجريبية (يمكن حذفها)
-- ============================================
INSERT INTO competition_days (day_number, day_name, day_date, is_active) VALUES
(1, 'اليوم الأول', CURRENT_DATE, true),
(2, 'اليوم الثاني', CURRENT_DATE + 1, false),
(3, 'اليوم الثالث', CURRENT_DATE + 2, false)
ON CONFLICT DO NOTHING;

INSERT INTO students (student_number, student_name, class_section) VALUES
('1001', 'الطالب التجريبي الأول', '6/1'),
('1002', 'الطالب التجريبي الثاني', '6/2'),
('1003', 'الطالب التجريبي الثالث', '6/3')
ON CONFLICT (student_number) DO NOTHING;
