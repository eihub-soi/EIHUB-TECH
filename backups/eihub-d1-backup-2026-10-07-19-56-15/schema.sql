CREATE TABLE profiles (
                    id VARCHAR(255) PRIMARY KEY,
                    firebase_uid VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    full_name VARCHAR(255),
                    role VARCHAR(255),
                    phone VARCHAR(255),
                    department VARCHAR(255),
                    institution VARCHAR(255),
                    register_number VARCHAR(255),
                    roll_number VARCHAR(255),
                    year_of_study VARCHAR(255),
                    faculty_id VARCHAR(255),
                    is_active INTEGER DEFAULT 1,
                    created_at VARCHAR(255),
                    updated_at VARCHAR(255)
                );

CREATE TABLE components (
                    id VARCHAR(255) PRIMARY KEY,
                    sku VARCHAR(255),
                    name VARCHAR(255),
                    category VARCHAR(255),
                    description TEXT,
                    total_stock INTEGER,
                    available_stock INTEGER,
                    borrowed_stock INTEGER DEFAULT 0,
                    cabinet VARCHAR(255),
                    shelf VARCHAR(255),
                    location VARCHAR(255),
                    location_details VARCHAR(255),
                    image_url VARCHAR(255),
                    unit VARCHAR(50),
                    unit_cost REAL,
                    updated_at VARCHAR(255),
                    created_at VARCHAR(255)
                );

CREATE TABLE requests (
                    id VARCHAR(255) PRIMARY KEY,
                    student_id VARCHAR(255),
                    component_id VARCHAR(255),
                    quantity INTEGER,
                    status VARCHAR(255),
                    notes TEXT,
                    reject_reason TEXT,
                    requested_at VARCHAR(255),
                    reviewed_by VARCHAR(255),
                    reviewed_at VARCHAR(255),
                    return_requested_at VARCHAR(255),
                    returned_at VARCHAR(255),
                    return_reviewed_by VARCHAR(255),
                    created_at VARCHAR(255)
                );

CREATE TABLE purchase_orders (
                    id VARCHAR(255) PRIMARY KEY,
                    po_number VARCHAR(255),
                    supplier_name VARCHAR(255),
                    component_id VARCHAR(255),
                    component_name VARCHAR(255),
                    component_category VARCHAR(255),
                    quantity INTEGER,
                    unit_cost REAL,
                    total_cost REAL,
                    purchased_by VARCHAR(255),
                    purchased_by_name VARCHAR(255),
                    invoice_ref VARCHAR(255),
                    cabinet VARCHAR(255),
                    shelf VARCHAR(255),
                    status VARCHAR(255),
                    purchased_at VARCHAR(255),
                    created_at VARCHAR(255)
                );

CREATE TABLE notifications (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    title VARCHAR(255),
                    message TEXT,
                    type VARCHAR(255),
                    is_read INTEGER DEFAULT 0,
                    link_url VARCHAR(255),
                    created_at VARCHAR(255),
                    FOREIGN KEY (user_id) REFERENCES profiles(id)
                );

CREATE TABLE reminder_logs (
    id VARCHAR(255) PRIMARY KEY,
    student_id VARCHAR(255),
    reminder_date VARCHAR(255),
    reminder_type VARCHAR(255)
);

CREATE TABLE audit_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    action VARCHAR(255),
                    details TEXT,
                    created_at VARCHAR(255)
                );

CREATE INDEX idx_profiles_created_at ON profiles(created_at);

CREATE INDEX idx_requests_requested_at ON requests(requested_at);

CREATE INDEX idx_reminder_logs_lookup ON reminder_logs(student_id, reminder_date, reminder_type);