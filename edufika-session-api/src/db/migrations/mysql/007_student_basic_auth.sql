CREATE TABLE IF NOT EXISTS student_accounts (
  studentid INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  `class` ENUM('Fase E', 'Fase F', 'Fase FL') NOT NULL,
  elective ENUM('RPL', 'DKV', 'AKL', 'LK', 'ULW', 'KTKK', 'TKJ', 'TAV', 'MPLB') NOT NULL,
  username VARCHAR(25) NOT NULL,
  password VARCHAR(50) NOT NULL,
  school_year DATETIME NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_student_accounts_name (name),
  UNIQUE KEY uq_student_accounts_username (username),
  UNIQUE KEY uq_student_accounts_password (password)
);

CREATE INDEX idx_student_accounts_username
ON student_accounts (username);
