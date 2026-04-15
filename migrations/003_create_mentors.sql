CREATE TABLE IF NOT EXISTS Mentors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(160) NOT NULL,
    specialization VARCHAR(180) NOT NULL,
    bio TEXT NOT NULL,
    portfolioUrl VARCHAR(255) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Mentors (fullName, specialization, bio, portfolioUrl)
SELECT 'Roman K.', 'Trap / Drill', '10+ лет в продакшене и работе с артистами.', 'https://soundcloud.com'
WHERE NOT EXISTS (SELECT 1 FROM Mentors WHERE fullName = 'Roman K.');

INSERT INTO Mentors (fullName, specialization, bio, portfolioUrl)
SELECT 'Alex M.', 'Mixing / Mastering', 'Инженер коммерческого звука и релизов.', 'https://youtube.com'
WHERE NOT EXISTS (SELECT 1 FROM Mentors WHERE fullName = 'Alex M.');

INSERT INTO Mentors (fullName, specialization, bio, portfolioUrl)
SELECT 'Vika P.', 'Ableton Live', 'Саунд-дизайн и live performance.', 'https://ableton.com'
WHERE NOT EXISTS (SELECT 1 FROM Mentors WHERE fullName = 'Vika P.');
