CREATE TABLE IF NOT EXISTS mock_gstin_registry (
    gstin TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    constitution TEXT NOT NULL,
    principal_place_of_business TEXT NOT NULL,
    state TEXT NOT NULL,
    registration_date DATE NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mock_udyam_registry (
    udyam_number TEXT PRIMARY KEY,
    enterprise_name TEXT NOT NULL,
    enterprise_type TEXT NOT NULL,
    major_activity TEXT NOT NULL,
    nic_description TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    date_of_registration DATE NOT NULL
);
