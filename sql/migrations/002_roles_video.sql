-- Incremental migration for the A4 schema. No DROP TABLE, TRUNCATE or reseeding.
-- The Node migration runner wraps this file and demo-account changes in one transaction.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'employee', 'customer'));

CREATE TABLE IF NOT EXISTS product_videos (
    video_id UUID PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    uploaded_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title VARCHAR(120) NOT NULL,
    transcript TEXT NOT NULL CHECK (char_length(transcript) BETWEEN 10 AND 5000),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('model_example', 'specific_unit')),
    unit_reference VARCHAR(100),
    recorded_on DATE,
    own_content BOOLEAN NOT NULL CHECK (own_content = true),
    status VARCHAR(20) NOT NULL DEFAULT 'uploading'
      CHECK (status IN ('uploading', 'pending', 'published', 'rejected', 'archived')),
    file_name VARCHAR(50) NOT NULL UNIQUE,
    byte_size BIGINT CHECK (byte_size > 0),
    duration_seconds NUMERIC(8,3) CHECK (duration_seconds > 0 AND duration_seconds <= 60),
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    has_audio BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    reviewed_by INTEGER REFERENCES users(user_id) ON DELETE RESTRICT,
    CHECK (scope <> 'specific_unit' OR (unit_reference IS NOT NULL AND char_length(unit_reference) >= 2))
);
CREATE INDEX IF NOT EXISTS idx_product_videos_product ON product_videos(product_id, created_at DESC);
CREATE TABLE IF NOT EXISTS video_review_events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES product_videos(video_id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
