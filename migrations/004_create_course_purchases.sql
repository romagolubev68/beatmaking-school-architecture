CREATE TABLE IF NOT EXISTS CoursePurchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    beatId INT NOT NULL,
    paidAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'paid',
    paidAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_course_purchase (userId, beatId),
    CONSTRAINT fk_course_purchases_user FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_purchases_beat FOREIGN KEY (beatId) REFERENCES Beats(id) ON DELETE CASCADE
);
