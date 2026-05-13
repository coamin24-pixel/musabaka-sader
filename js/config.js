// ============================================
// إعدادات Supabase
// ============================================
// قم بتغيير هذه القيم بالقيم الخاصة بمشروعك من Supabase Dashboard
const SUPABASE_CONFIG = {
    // احصل على هذه القيم من: https://app.supabase.com/project/_/settings/api
    SUPABASE_URL: 'https://eoftynstyrublblzabtt.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZnR5bnN0eXJ1YmxibHphYnR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDcwMTcsImV4cCI6MjA5NDIyMzAxN30.YTG96bEdARHIw5XV5jCOY5iG5tvb4z2zcu-OrYDetyo',
    
    // إعدادات التطبيق
    SCHOOL_NAME: 'مدرسة الزبير بن العوام الابتدائية للبنين',
    COMPETITION_TITLE: 'المسابقة الثقافية للصف السادس',
    QUESTIONS_PER_DAY: 18,
    TIME_PER_QUESTION: 30, // ثواني
    POINTS_BASE: 100, // النقاط الأساسية للإجابة الصحيحة
    SPEED_BONUS_MAX: 50, // أقصى نقاط إضافية للسرعة
    
    // كلمة مرور المسؤول (قم بتغييرها)
    ADMIN_PASSWORD: 'Admin1199!@$'
};

// تهيئة عميل Supabase
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('مكتبة Supabase غير محملة!');
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.SUPABASE_URL,
            SUPABASE_CONFIG.SUPABASE_ANON_KEY
        );
    }
    return supabaseClient;
}

// تصدير للاستخدام في الملفات الأخرى
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
    window.initSupabase = initSupabase;
}
