
export const COLORS = {
  BG: '#050505',
  PRIMARY: '#39ff14',
  SECONDARY: '#1a1a1a',
  ALERT: '#ff3131',
  SUCCESS: '#00ffcc',
};

export const AUTH = {
  STUDENT_TOKEN: 'StudentID',
  ADMIN_TOKEN: 'AdminID',
  DEV_TOKEN: 'EDU_DEV_ACCESS',
  PROCTOR_PIN: '1234',
};

export const WHITELIST_URLS = [
  'https://exam.school.edu',
  'https://lms.edufika.com',
  'https://google.com'
];

export const TRANSLATIONS = {
  EN: {
    // General
    back: "Back",
    cancel: "Cancel",
    exit: "Exit",
    abort: "Abort",
    confirm: "Confirm",
    save: "Commit & Save",
    
    // Login
    auth_session: "Auth_Session",
    encryption: "Encryption: AES-256-EDU",
    enter_token: "Enter_Token_ID",
    execute_handshake: "Execute_Handshake",
    master_id: "Master_ID",
    proctor: "Proctor",

    // Selection
    exam_init: "Exam Initiation",
    selection_desc: "You have successfully authorized. Please select the method to access your assigned examination URL.",
    scan_qr: "Scan QR Token",
    manual_input: "Manual URL Input",
    lockdown_warning: "Warning: Lockdown mode will activate immediately after URL loading.",

    // Manual Input
    target_endpoint: "Target_Endpoint",
    registry_protocol: "Registry Protocol URL",
    deploy_engine: "Deploy Engine",

    // Admin
    proctor_ctrl: "PROCTOR_CTRL",
    tab_monitor: "MONITOR",
    tab_tokens: "TOKENS",
    tab_whitelist: "WHITELIST",
    active_nodes: "Active Nodes",
    nodes_live: "Nodes_Live",
    telemetry: "Telemetry_Stream",
    manage_node: "Manage_Node",
    node_settings: "Node_Settings",
    bypass_pin: "Bypass_PIN_State",
    abort_session: "Abort Session",
    node_registry: "Active_Session_Registry",
    regen_global: "Regen_Global",
    assigned_user: "Assigned_User",
    detected_device: "Detected_Device",
    inspect: "Inspect",
    confirm_abort: "Confirm_Abort?",
    abort_desc: "Terminating this session will immediately lock the student's device and log a hard-stop violation.",
    confirm_term: "Confirm_Termination",

    // Violation
    security_alert: "SECURITY_ALERT",
    session_locked: "SESSION_LOCKED",
    violation_desc: "Lockdown Engine detected unauthorized activity. System has flagged this device for proctor review.",
    return_to_login: "RETURN TO LOGIN",
    proctor_logs: "[ PROCTOR_LOG_ACCESS ]",

    // Success
    mission_complete: "Mission Complete",
    success_desc: "Your examination session has been successfully closed. All background activity data has been synced to the proctor node.",
    receipt: "Submission Receipt",
    close_app: "CLOSE APPLICATION",

    // Settings
    config_title: "Local_Config",
    user_role: "User_Role",
    lang_registry: "01_Language_Registry",
    ui_scale: "02_Interface_Scale",
    sys_protocols: "03_System_Protocols",
    secure_alarm: "SECURE_ALARM",
    alarm_desc: "Max volume on violation detection",
    handshake_note: "Note: Changes require a hardware-level handshake.",

    // Splash / Scanner
    mounting_ui: "Mounting UI Context...",
    scan_desc: "Position QR code within the frame...",
    cancel_scan: "CANCEL SCAN"
  },
  ID: {
    // General
    back: "Kembali",
    cancel: "Batal",
    exit: "Keluar",
    abort: "Hentikan",
    confirm: "Konfirmasi",
    save: "Simpan Perubahan",

    // Login
    auth_session: "Sesi_Otentikasi",
    encryption: "Enkripsi: AES-256-EDU",
    enter_token: "Masukkan_ID_Token",
    execute_handshake: "Mulai_Handshake",
    master_id: "ID_Master",
    proctor: "Pengawas",

    // Selection
    exam_init: "Inisiasi Ujian",
    selection_desc: "Otorisasi berhasil. Silakan pilih metode untuk mengakses URL ujian yang ditentukan.",
    scan_qr: "Pindai Token QR",
    manual_input: "Input URL Manual",
    lockdown_warning: "Peringatan: Mode lockdown akan aktif segera setelah URL dimuat.",

    // Manual Input
    target_endpoint: "Titik_Tujuan",
    registry_protocol: "URL Protokol Registri",
    deploy_engine: "Aktifkan Mesin",

    // Admin
    proctor_ctrl: "KONTROL_PENGAWAS",
    tab_monitor: "PANTAU",
    tab_tokens: "TOKEN",
    tab_whitelist: "WHITELIST",
    active_nodes: "Node Aktif",
    nodes_live: "Node_Langsung",
    telemetry: "Aliran_Telemetri",
    manage_node: "Kelola_Node",
    node_settings: "Pengaturan_Node",
    bypass_pin: "Status_PIN_Bypass",
    abort_session: "Hentikan Sesi",
    node_registry: "Registri_Sesi_Aktif",
    regen_global: "Regenerasi_Global",
    assigned_user: "Pengguna_Terdaftar",
    detected_device: "Perangkat_Terdeteksi",
    inspect: "Periksa",
    confirm_abort: "Konfirmasi_Penghentian?",
    abort_desc: "Menghentikan sesi ini akan segera mengunci perangkat siswa dan mencatat pelanggaran berat.",
    confirm_term: "Konfirmasi_Penghentian",

    // Violation
    security_alert: "PERINGATAN_KEAMANAN",
    session_locked: "SESI_TERKUNCI",
    violation_desc: "Mesin Lockdown mendeteksi aktivitas tidak sah. Sistem telah menandai perangkat ini untuk ditinjau pengawas.",
    return_to_login: "KEMBALI KE LOGIN",
    proctor_logs: "[ AKSES_LOG_PENGAWAS ]",

    // Success
    mission_complete: "Misi Selesai",
    success_desc: "Sesi ujian Anda telah ditutup dengan sukses. Semua data aktivitas latar belakang telah disinkronkan ke node pengawas.",
    receipt: "Bukti Penyerahan",
    close_app: "TUTUP APLIKASI",

    // Settings
    config_title: "Konfig_Lokal",
    user_role: "Peran_Pengguna",
    lang_registry: "01_Registri_Bahasa",
    ui_scale: "02_Skala_Antarmuka",
    sys_protocols: "03_Protokol_Sistem",
    secure_alarm: "ALARM_KEAMANAN",
    alarm_desc: "Volume maksimal saat deteksi pelanggaran",
    handshake_note: "Catatan: Perubahan memerlukan jabat tangan tingkat perangkat keras.",

    // Splash / Scanner
    mounting_ui: "Memuat Konteks Antarmuka...",
    scan_desc: "Posisikan kode QR di dalam bingkai...",
    cancel_scan: "BATALKAN PINDAI"
  }
};
