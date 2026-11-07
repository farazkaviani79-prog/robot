-- فقط برای توسعه محلی (رمزهای زیر نمونه‌اند). در Production نقش‌ها را با رمز قوی و جدا بسازید.
CREATE ROLE botshop_app    LOGIN PASSWORD 'CHANGE_ME_app'    NOSUPERUSER NOBYPASSRLS;
CREATE ROLE botshop_system LOGIN PASSWORD 'CHANGE_ME_system' NOSUPERUSER BYPASSRLS;
