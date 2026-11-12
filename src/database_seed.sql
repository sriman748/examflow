--
-- PostgreSQL database dump
--

-- Dumped from database version 16.6
-- Dumped by pg_dump version 16.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public, pg_catalog;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.tests DROP CONSTRAINT IF EXISTS tests_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.tests DROP CONSTRAINT IF EXISTS tests_course_id_fkey;
ALTER TABLE IF EXISTS ONLY public.test_questions DROP CONSTRAINT IF EXISTS test_questions_test_id_fkey;
ALTER TABLE IF EXISTS ONLY public.test_questions DROP CONSTRAINT IF EXISTS test_questions_question_id_fkey;
ALTER TABLE IF EXISTS ONLY public.results DROP CONSTRAINT IF EXISTS results_attempt_id_fkey;
ALTER TABLE IF EXISTS ONLY public.responses DROP CONSTRAINT IF EXISTS responses_question_id_fkey;
ALTER TABLE IF EXISTS ONLY public.responses DROP CONSTRAINT IF EXISTS responses_attempt_id_fkey;
ALTER TABLE IF EXISTS ONLY public.questions DROP CONSTRAINT IF EXISTS questions_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.questions DROP CONSTRAINT IF EXISTS questions_course_id_fkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_faculty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attempts DROP CONSTRAINT IF EXISTS attempts_test_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attempts DROP CONSTRAINT IF EXISTS attempts_student_id_fkey;
DROP INDEX IF EXISTS public.questions_course_id_idx;
DROP INDEX IF EXISTS public.attempts_test_id_idx;
DROP INDEX IF EXISTS public.attempts_deadline_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.tests DROP CONSTRAINT IF EXISTS tests_share_code_key;
ALTER TABLE IF EXISTS ONLY public.tests DROP CONSTRAINT IF EXISTS tests_pkey;
ALTER TABLE IF EXISTS ONLY public.test_questions DROP CONSTRAINT IF EXISTS test_questions_pkey;
ALTER TABLE IF EXISTS ONLY public.results DROP CONSTRAINT IF EXISTS results_pkey;
ALTER TABLE IF EXISTS ONLY public.responses DROP CONSTRAINT IF EXISTS responses_pkey;
ALTER TABLE IF EXISTS ONLY public.questions DROP CONSTRAINT IF EXISTS questions_pkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_pkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_pkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_code_key;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.attempts DROP CONSTRAINT IF EXISTS attempts_test_id_student_id_key;
ALTER TABLE IF EXISTS ONLY public.attempts DROP CONSTRAINT IF EXISTS attempts_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.tests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.questions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.courses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.attempts ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.tests_id_seq;
DROP TABLE IF EXISTS public.tests;
DROP TABLE IF EXISTS public.test_questions;
DROP TABLE IF EXISTS public.results;
DROP TABLE IF EXISTS public.responses;
DROP SEQUENCE IF EXISTS public.questions_id_seq;
DROP TABLE IF EXISTS public.questions;
DROP TABLE IF EXISTS public.enrollments;
DROP SEQUENCE IF EXISTS public.courses_id_seq;
DROP TABLE IF EXISTS public.courses;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
DROP SEQUENCE IF EXISTS public.attempts_id_seq;
DROP TABLE IF EXISTS public.attempts;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempts (
    id integer NOT NULL,
    test_id integer,
    student_id integer,
    started_at timestamp with time zone DEFAULT now(),
    deadline timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone
);


--
-- Name: attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attempts_id_seq OWNED BY public.attempts.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action text,
    detail jsonb,
    at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    faculty_id integer
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    course_id integer NOT NULL,
    student_id integer NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    course_id integer NOT NULL,
    created_by integer,
    type text NOT NULL,
    text text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    correct jsonb DEFAULT '[]'::jsonb,
    marks numeric DEFAULT 1,
    negative_marks numeric DEFAULT 0,
    difficulty text DEFAULT 'medium'::text,
    topic text,
    explanation text,
    archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT questions_type_check CHECK ((type = ANY (ARRAY['single'::text, 'multiple'::text, 'true_false'::text, 'fill'::text, 'numerical'::text, 'short'::text])))
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responses (
    attempt_id integer NOT NULL,
    question_id integer NOT NULL,
    answer jsonb,
    marked boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.results (
    attempt_id integer NOT NULL,
    score numeric,
    total numeric,
    correct integer,
    wrong integer,
    unattempted integer,
    passed boolean
);


--
-- Name: test_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_questions (
    test_id integer NOT NULL,
    question_id integer NOT NULL,
    "position" integer
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id integer NOT NULL,
    course_id integer NOT NULL,
    created_by integer,
    title text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    duration_min integer NOT NULL,
    pass_marks numeric DEFAULT 0,
    shuffle boolean DEFAULT true,
    published boolean DEFAULT false,
    results_released boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    share_code text
);


--
-- Name: tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tests_id_seq OWNED BY public.tests.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    failed_logins integer DEFAULT 0,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    roll_number text,
    employee_id text,
    department text,
    designation text,
    year_sem text,
    phone text,
    specialization text,
    auth_provider text DEFAULT 'local'::text,
    avatar_url text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'faculty'::text, 'student'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts ALTER COLUMN id SET DEFAULT nextval('public.attempts_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests ALTER COLUMN id SET DEFAULT nextval('public.tests_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: attempts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.attempts (id, test_id, student_id, started_at, deadline, submitted_at) VALUES (2, 4, 3, '2026-11-12 20:21:24.859823+05:30', '2026-11-12 20:22:24.859+05:30', '2026-11-12 20:22:24.859+05:30');


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (1, 1, 'user.create', '{"id": 2}', '2026-11-11 18:44:51.571427+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (2, 1, 'user.create', '{"id": 3}', '2026-11-11 18:55:07.879329+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (3, 1, 'user.status', '{"status": "inactive"}', '2026-11-11 18:57:00.725105+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (4, 1, 'user.status', '{"status": "active"}', '2026-11-11 18:57:02.281383+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (5, 1, 'user.status', '{"status": "inactive"}', '2026-11-11 18:57:31.340883+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (6, 1, 'user.status', '{"status": "active"}', '2026-11-11 18:57:32.389492+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (7, 2, 'test.create', '{"id": 1}', '2026-11-11 19:00:38.480368+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (8, 2, 'test.publish', '{"id": 1}', '2026-11-11 19:00:41.686015+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (9, 2, 'test.release', '{"id": 1}', '2026-11-11 19:02:03.039806+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (10, 2, 'test.release', '{"id": 1}', '2026-11-11 19:02:05.631992+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (11, 2, 'test.release', '{"id": 1}', '2026-11-11 19:02:07.677291+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (12, 2, 'test.publish', '{"id": 1}', '2026-11-11 19:02:28.669095+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (13, 2, 'test.publish', '{"id": 1}', '2026-11-11 19:02:30.475755+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (14, 1, 'user.create', '{"id": 38}', '2026-11-12 19:07:21.742021+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (15, 2, 'test.publish', '{"id": 1}', '2026-11-12 19:13:05.643665+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (16, 38, 'test.create', '{"id": 2}', '2026-11-12 19:28:05.847493+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (17, 38, 'test.publish', '{"id": 2}', '2026-11-12 19:28:05.858529+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (18, 2, 'test.create', '{"id": 3}', '2026-11-12 19:43:39.9857+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (19, 2, 'test.publish', '{"id": 3}', '2026-11-12 19:43:46.202823+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (20, 2, 'test.release', '{"id": 3}', '2026-11-12 19:46:35.132474+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (21, 1, 'user.create', '{"id": 42}', '2026-11-12 19:51:04.357418+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (22, 1, 'user.create', '{"id": 43}', '2026-11-12 19:51:28.137464+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (23, 1, 'user.create', '{"id": 44}', '2026-11-12 19:51:47.11187+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (24, 2, 'test.release', '{"id": 3}', '2026-11-12 19:55:32.141396+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (25, 2, 'test.publish', '{"id": 3}', '2026-11-12 19:55:35.6512+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (26, 1, 'user.update', '{"id": "42"}', '2026-11-12 20:08:32.051325+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (27, 42, 'test.create', '{"id": 4}', '2026-11-12 20:19:45.780503+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (28, 42, 'test.publish', '{"id": 4}', '2026-11-12 20:21:05.38865+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (29, 2, 'test.release', '{"id": 4}', '2026-11-12 20:24:01.165404+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (30, 42, 'test.publish', '{"id": 4}', '2026-11-12 20:51:10.85252+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (31, 82, 'user.register', '{"role": "student"}', '2026-11-12 21:27:40.039469+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (32, 83, 'user.register', '{"role": "faculty"}', '2026-11-12 21:27:40.567576+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (33, 84, 'user.register.google', '{"role": "student"}', '2026-11-12 21:27:40.702821+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (34, 83, 'user.profile_update', '{}', '2026-11-12 21:27:40.742442+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (35, 85, 'user.register.google', '{"role": "faculty"}', '2026-11-12 21:41:50.551555+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (36, 87, 'user.register', '{"role": "faculty"}', '2026-11-12 21:55:52.129655+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (37, 88, 'user.register', '{"role": "faculty"}', '2026-11-12 21:55:52.552302+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (38, 87, 'test.create', '{"id": 5}', '2026-11-12 21:55:52.613011+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (39, 1, 'user.update', '{"id": "42"}', '2026-11-12 22:08:21.994376+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (40, 91, 'user.register', '{"role": "faculty"}', '2026-11-13 00:33:16.506153+05:30');
INSERT INTO public.audit_logs (id, user_id, action, detail, at) VALUES (41, 1, 'user.create', '{"id": 92}', '2026-11-13 00:35:29.987723+05:30');


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.courses (id, code, name, faculty_id) VALUES (1, '001', 'sql', 1);
INSERT INTO public.courses (id, code, name, faculty_id) VALUES (4, 'rdbms', 's', 2);
INSERT INTO public.courses (id, code, name, faculty_id) VALUES (5, 'CS101', 'Data Structures & Algorithms', 38);
INSERT INTO public.courses (id, code, name, faculty_id) VALUES (6, 'CS-PY101', 'Python Programming & Data Analysis', 42);
INSERT INTO public.courses (id, code, name, faculty_id) VALUES (7, 'SEC_1794500751672', 'Security Architecture', 87);


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.enrollments (course_id, student_id) VALUES (1, 1);
INSERT INTO public.enrollments (course_id, student_id) VALUES (5, 2);
INSERT INTO public.enrollments (course_id, student_id) VALUES (4, 3);
INSERT INTO public.enrollments (course_id, student_id) VALUES (4, 41);
INSERT INTO public.enrollments (course_id, student_id) VALUES (6, 1);
INSERT INTO public.enrollments (course_id, student_id) VALUES (6, 2);
INSERT INTO public.enrollments (course_id, student_id) VALUES (6, 3);
INSERT INTO public.enrollments (course_id, student_id) VALUES (5, 39);
INSERT INTO public.enrollments (course_id, student_id) VALUES (1, 3);
INSERT INTO public.enrollments (course_id, student_id) VALUES (5, 3);


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (1, 4, 2, 'single', 'Which SQL function is used to count the number of rows in a SQL query?', '["COUNT()", "NUMBER()", "SUM()", "COUNT(*)"]', '[3]', 1, 0, 'medium', NULL, NULL, false, '2026-11-11 19:00:03.031546+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (2, 4, 2, 'single', 'Which SQL keyword is used to retrieve a maximum value?', '["MOST", "TOP", "MAX", "UPPER"]', '[2]', 1, 0, 'medium', NULL, NULL, false, '2026-11-11 19:00:03.043062+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (3, 4, 2, 'single', 'Which of the following SQL clauses is used to DELETE tuples from a database', '["DELETE", "REMOVE", "DROP", "CLEAR"]', '[0]', 1, 0, 'medium', NULL, NULL, false, '2026-11-11 19:00:03.04897+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (4, 4, 2, 'single', '___________removes all rows from a table without logging the individual row', '["DELETE", "REMOVE", "DROP", "TRUNCATE"]', '[3]', 1, 0, 'medium', NULL, NULL, false, '2026-11-11 19:00:03.054937+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (5, 4, 2, 'single', 'Which of the following is not a DDL command?', '["UPDATE", "TRUNCATE", "ALTER", "None of the Mentioned"]', '[0]', 1, 0, 'medium', NULL, NULL, false, '2026-11-11 19:00:03.060461+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (6, 5, 38, 'single', 'What is the average time complexity of Binary Search?', '["O(n)", "O(log n)", "O(n^2)", "O(1)"]', '[1]', 2, 0, 'medium', NULL, NULL, false, '2026-11-12 19:28:05.820066+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (7, 5, 38, 'true_false', 'A stack is a First-In-First-Out (FIFO) data structure.', '["True", "False"]', '["false"]', 1, 0, 'medium', NULL, NULL, false, '2026-11-12 19:28:05.827356+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (8, 1, 42, 'single', 'Which SQL function is used to count the number of rows in a SQL query?', '["COUNT()", "NUMBER()", "SUM()", "COUNT(*)"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.445372+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (9, 1, 42, 'single', 'Which SQL keyword is used to retrieve a maximum value?', '["MOST", "TOP", "MAX", "UPPER"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.452193+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (10, 1, 42, 'single', 'Which of the following SQL clauses is used to DELETE tuples from a database table?', '["DELETE", "REMOVE", "DROP", "CLEAR"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.455711+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (11, 1, 42, 'single', '___________removes all rows from a table without logging the individual row deletions.', '["DELETE", "REMOVE", "DROP", "TRUNCATE"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.459175+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (12, 1, 42, 'single', 'Which of the following is not a DDL command?', '["UPDATE", "TRUNCATE", "ALTER", "None of the Mentioned"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.462616+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (13, 1, 42, 'single', 'Which of the following are TCL commands?', '["UPDATE and TRUNCATE", "SELECT and INSERT", "GRANT and REVOKE", "ROLLBACK and SAVEPOINT"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.465848+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (14, 1, 42, 'single', '________________ is not a category of SQL command.', '["TCL", "SCL", "DCL", "DDL"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.469502+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (15, 1, 42, 'single', 'If you don’t specify ASC or DESC after a SQL ORDER BY clause, the following is used by default ______________', '["ASC", "DESC", "There is no default value", "None of the mentioned"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.473436+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (16, 1, 42, 'single', 'Which of the following statement is true?', '["DELETE does not free the space containing the table and TRUNCATE free the space", "Both DELETE and TRUNCATE free the space containing the table", "Both DELETE and TRUNCATE does not free the space containing the table", "DELETE free the space containing the table and TRUNCATE does not free the space"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.476881+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (17, 1, 42, 'single', 'What is the purpose of the SQL AS clause?', '["The AS SQL clause is used to change the name of a column in the result set or to assign a", "The AS clause is used with the JOIN clause only", "The AS clause defines a search condition", "All of the mentioned"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.480264+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (18, 1, 42, 'single', 'What does DML stand for?', '["Different Mode Level", "Data Model Language", "Data Mode Lane", "Data Manipulation language"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.48336+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (19, 1, 42, 'single', 'With SQL, how do you select all the records from a table named “Persons” where the value of the column “FirstName” ends with an “a”?', '["SELECT * FROM Persons WHERE FirstName=’a’", "SELECT * FROM Persons WHERE FirstName LIKE ‘a%’", "SELECT * FROM Persons WHERE FirstName LIKE ‘%a’", "SELECT * FROM Persons WHERE FirstName=’%a%’"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.48665+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (20, 1, 42, 'single', 'With SQL, how can you return all the records from a table named “Persons” sorted descending by “FirstName”?', '["SELECT * FROM Persons SORT BY ‘FirstName’ DESC", "SELECT * FROM Persons ORDER FirstName DESC", "SELECT * FROM Persons SORT ‘FirstName’ DESC", "SELECT * FROM Persons ORDER BY FirstName DESC"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.489762+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (21, 1, 42, 'single', 'With SQL, how can you return the number of not null records in the “Persons” table?', '["SELECT COUNT() FROM Persons", "SELECT COLUMNS() FROM Persons", "SELECT COLUMNS(*) FROM Persons", "SELECT COUNT(*) FROM Persons"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.492937+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (22, 1, 42, 'single', 'What does the ALTER TABLE clause do?', '["The SQL ALTER TABLE clause modifies a table definition by altering, adding, or deleting table", "The SQL ALTER TABLE clause is used to insert data into database table", "THE SQL ALTER TABLE deletes data from database table", "The SQL ALTER TABLE clause is used to delete a database table"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.495998+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (23, 1, 42, 'single', 'The UPDATE SQL clause can _____________', '["update only one row at a time", "update more than one row at a time", "delete more than one row at a time", "delete only one row at a time"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.498873+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (24, 1, 42, 'single', 'The UNION SQL clause can be used with _____________', '["SELECT clause only", "DELETE and UPDATE clauses", "UPDATE clause only", "All of the mentioned"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.501681+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (25, 1, 42, 'single', 'Which SQL statement is used to return only different values?', '["SELECT DIFFERENT", "SELECT UNIQUE", "SELECT DISTINCT", "SELECT ALL"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.504408+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (26, 1, 42, 'single', 'Which SQL keyword is used to sort the result-set?', '["ORDER BY", "SORT", "ORDER", "SORT BY"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.507213+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (27, 1, 42, 'single', 'How can you change “Hansen” into “Nilsen” in the “LastName” column in the Persons table?', '["UPDATE Persons SET LastName=’Hansen’ INTO LastName=’Nilsen’", "MODIFY Persons SET LastName=’Nilsen’ WHERE LastName=’Hansen’", "MODIFY Persons SET LastName=’Hansen’ INTO LastName=’Nilsen’", "UPDATE Persons SET LastName=’Nilsen’ WHERE LastName=’Hansen’"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.510098+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (28, 1, 42, 'single', 'Which of the following command makes the updates performed by the transaction permanent in the database?', '["ROLLBACK", "COMMIT", "TRUNCATE", "DELETE"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.513021+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (29, 1, 42, 'single', 'Which TCL command undo all the updates performed by the SQL in the transaction?', '["ROLLBACK", "COMMIT", "TRUNCATE", "DELETE"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.516056+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (30, 1, 42, 'single', 'SQL query to find all the cities whose humidity is 95.', '["SELECT city WHERE humidity = 95", "SELECT city FROM weather WHERE humidity = 95", "SELECT humidity = 89 FROM weather", "SELECT city FROM weather"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.518779+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (31, 1, 42, 'single', 'SQL query to find the temperature in increasing order of all cities.', '["SELECT city FROM weather ORDER BY temperature", "SELECT city, temperature FROM weather", "SELECT city, temperature FROM weather ORDER BY temperature", "SELECT city, temperature FROM weather ORDER BY city"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.521605+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (32, 1, 42, 'single', 'What is the meaning of LIKE ‘%0%0%’?', '["Feature begins with two 0’s", "Feature ends with two 0’s", "Feature has more than two 0’s", "Feature has two 0’s in it, at any position"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.525354+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (33, 1, 42, 'single', 'Find the names of these cities with temperature and condition whose condition is neither sunny nor cloudy.', '["SELECT city, temperature, condition FROM weather WHERE condition NOT IN (‘sunny’,", "SELECT city, temperature, condition FROM weather WHERE condition NOT BETWEEN", "SELECT city, temperature, condition FROM weather WHERE condition IN (‘sunny’, ‘cloudy’)", "SELECT city, temperature, condition FROM weather WHERE condition BETWEEN (‘sunny’,"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.528351+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (34, 1, 42, 'single', 'Find the name of those cities with temperature and condition whose condition is either sunny or cloudy but temperature must be greater than 70.', '["SELECT city, temperature, condition FROM weather WHERE condition = ‘sunny’ AND", "SELECT city, temperature, condition FROM weather WHERE condition = ‘sunny’ OR condition", "SELECT city, temperature, condition FROM weather WHERE condition = ‘sunny’ OR condition", "SELECT city, temperature, condition FROM weather WHERE condition = ‘sunny’ AND"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.531749+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (35, 1, 42, 'single', 'Find all the tuples having a temperature greater than ‘Paris’.', '["SELECT * FROM weather WHERE temperature > (SELECT temperature FROM weather", "SELECT * FROM weather WHERE temperature > (SELECT * FROM weather WHERE city =", "SELECT * FROM weather WHERE temperature > (SELECT city FROM weather WHERE city", "SELECT * FROM weather WHERE temperature > ‘Paris’ temperature"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.53475+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (36, 1, 42, 'single', 'Find all the cities with temperature, condition and humidity whose humidity is in the range of 63 to 79.', '["SELECT * FROM weather WHERE humidity IN (63 to 79)", "SELECT * FROM weather WHERE humidity NOT IN (63 AND 79)", "SELECT * FROM weather WHERE humidity BETWEEN 63 AND 79", "SELECT * FROM weather WHERE humidity NOT BETWEEN 63 AND 79"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.537628+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (37, 1, 42, 'single', 'The command to remove rows from a table ‘CUSTOMER’ is __________________', '["DROP FROM CUSTOMER", "UPDATE FROM CUSTOMER", "REMOVE FROM CUSTOMER", "DELETE FROM CUSTOMER WHERE"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.540247+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (38, 1, 42, 'single', 'What type of join is needed when you wish to include rows that do not have matching values?', '["Equi-join", "Natural join", "Outer join", "All of the Mentioned"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.542706+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (39, 1, 42, 'single', 'What type of join is needed when you wish to return rows that do have matching values?', '["Equi-join", "Natural join", "Outer join", "All of the Mentioned"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.54516+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (40, 1, 42, 'single', 'Which of the following is one of the basic approaches for joining tables?', '["Subqueries", "Union Join", "Natural join", "All of the Mentioned"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.548016+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (41, 1, 42, 'single', 'The following SQL is which type of join: SELECT CUSTOMER_T. CUSTOMER_ID, ORDER_T. CUSTOMER_ID, NAME, ORDER_ID FROM CUSTOMER_T,ORDER_T WHERE CUSTOMER_T. CUSTOMER_ID = ORDER_T. CUSTOMER_ID?', '["Equi-join", "Natural join", "Outer join", "Cartesian join"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.550937+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (42, 1, 42, 'single', 'A UNION query is which of the following?', '["Combines the output from no more than two queries and must include the same number of", "Combines the output from no more than two queries and does not include the same number of", "Combines the output from multiple queries and must include the same number of columns", "Combines the output from multiple queries and does not include the same number of columns"]', '[2]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.553915+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (43, 1, 42, 'single', 'Which of the following statements is true concerning subqueries?', '["Involves the use of an inner and outer query", "Cannot return the same result as a query that is not a subquery", "Does not start with the word SELECT", "All of the mentioned"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.556879+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (44, 1, 42, 'single', 'Which of the following is a correlated subquery?', '["Uses the result of an inner query to determine the processing of an outer query", "Uses the result of an outer query to determine the processing of an inner query", "Uses the result of an inner query to determine the processing of an inner query", "Uses the result of an outer query to determine the processing of an outer query"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.559613+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (45, 1, 42, 'single', 'The following SQL is which type of join: SELECT CUSTOMER_T. CUSTOMER_ID, ORDER_T. CUSTOMER_ID, NAME, ORDER_ID FROM CUSTOMER_T,ORDER_T?', '["Equi-join", "Natural join", "Outer join", "Cartesian join"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.562752+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (46, 1, 42, 'single', 'Which is not a type of join in T-SQL?', '["Equi-join", "Natural join", "Outer join", "Cartesian join"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.56583+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (47, 1, 42, 'single', 'What is a view?', '["A view is a special stored procedure executed when certain event occurs", "A view is a virtual table which results of executing a pre-compiled query", "A view is a database diagram", "None of the Mentioned"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.56873+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (48, 1, 42, 'single', 'Which of the following is not a limitation of view?', '["ORDER BY Does Not Work", "Index Created on View Used Often", "Cross Database Queries Not Allowed in Indexed View", "Adding Column is Expensive by Joining Table Outside View"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.571496+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (49, 1, 42, 'single', 'Which of the following statement is true?', '["Views could be looked as an additional layer on the table which enables us to protect intricate", "Views are virtual tables that are compiled at run time", "Creating views can improve query response time", "All of the Mentioned"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.574292+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (50, 1, 42, 'single', 'SQL Server has mainly how many types of views?', '["one", "two", "three", "four"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.577216+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (51, 1, 42, 'single', 'Dynamic Management View is a type of ___________', '["System Defined Views", "User Defined View", "Simple View", "Complex View"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.580058+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (52, 1, 42, 'single', 'Syntax for creating views is __________', '["CREATE VIEW AS SELECT", "CREATE VIEW AS UPDATE", "DROP VIEW AS SELECT", "CREATE VIEW AS UPDATE"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.582733+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (53, 1, 42, 'single', 'You can delete a view with ___________ command.', '["DROP VIEW", "DELETE VIEW", "REMOVE VIEW", "TRUNCATE VIEW"]', '[0]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.585649+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (54, 1, 42, 'single', 'What is SCHEMABINDING a VIEW?', '["Schema binding binds your views to the dependent physical columns of the accessed tables", "These are stored only in the Master database", "These types of view are defined by users on a specified schema", "These are used to show database self describing information"]', '[1]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.588519+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (55, 1, 42, 'single', 'Which of the following is not a SQL Server INFORMATION_SCHEMA view?', '["INFORMATION_SCHEMA.CONSTRAINT_TABLE_USAGE", "INFORMATION_SCHEMA.DOMAIN_CONSTRAINTS", "INFORMATION_SCHEMA.KEY_COLUMN_USAGE", "sys.dm_exec_connections"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.591446+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (56, 1, 42, 'single', '___________ is stored only in the Master database.', '["Database-scoped Dynamic Management View", "Complex View", "Catalog View", "None of the mentioned"]', '[3]', 1, 0, 'medium', NULL, '', false, '2026-11-12 20:50:04.594164+05:30');
INSERT INTO public.questions (id, course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation, archived, created_at) VALUES (57, 7, 87, 'single', 'Is least privilege essential?', '["Yes", "No"]', '["0"]', 2, 0, 'medium', NULL, NULL, false, '2026-11-12 21:55:52.584886+05:30');


--
-- Data for Name: responses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.responses (attempt_id, question_id, answer, marked, updated_at) VALUES (2, 3, '"0"', false, '2026-11-12 20:21:32.88228+05:30');
INSERT INTO public.responses (attempt_id, question_id, answer, marked, updated_at) VALUES (2, 1, '"1"', false, '2026-11-12 20:21:36.876838+05:30');
INSERT INTO public.responses (attempt_id, question_id, answer, marked, updated_at) VALUES (2, 5, '"0"', false, '2026-11-12 20:21:36.878332+05:30');
INSERT INTO public.responses (attempt_id, question_id, answer, marked, updated_at) VALUES (2, 4, '"2"', false, '2026-11-12 20:21:40.879769+05:30');
INSERT INTO public.responses (attempt_id, question_id, answer, marked, updated_at) VALUES (2, 2, '"3"', true, '2026-11-12 20:22:12.87953+05:30');


--
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.results (attempt_id, score, total, correct, wrong, unattempted, passed) VALUES (2, 2, 5, 2, 3, 0, true);


--
-- Data for Name: test_questions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (4, 5, 0);
INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (4, 4, 1);
INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (4, 3, 2);
INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (4, 2, 3);
INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (4, 1, 4);
INSERT INTO public.test_questions (test_id, question_id, "position") VALUES (5, 57, 0);


--
-- Data for Name: tests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tests (id, course_id, created_by, title, start_at, end_at, duration_min, pass_marks, shuffle, published, results_released, created_at, share_code) VALUES (4, 4, 42, 'B1', '2026-11-12 20:21:00+05:30', '2026-11-13 00:22:00+05:30', 1, 1, true, false, true, '2026-11-12 20:19:45.768638+05:30', 'c7594b282ac8');
INSERT INTO public.tests (id, course_id, created_by, title, start_at, end_at, duration_min, pass_marks, shuffle, published, results_released, created_at, share_code) VALUES (5, 7, 87, 'Alice Midterm', '2026-11-12 21:54:52.594+05:30', '2026-11-12 23:55:52.594+05:30', 60, 1, true, false, false, '2026-11-12 21:55:52.603647+05:30', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (91, 'Prof. TestFaculty', 'testfac_1794510196264@mvsrec.edu.in', '$2a$12$KUc3UfBgOXN42nAIbCkuu.XY6BhU.WotFDpXG6bcG.L21OJDiSLhe', 'faculty', 'active', 0, NULL, '2026-11-13 00:33:16.50426+05:30', NULL, NULL, 'CSE', NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (92, 'sparky', 'sparkyzen0@gmail.com', '$2a$12$nyqHkxIumX5s/F3vTC3IXObL3mDtrzzxZF/bqQZpFPPg6FU0IWbhi', 'admin', 'active', 0, NULL, '2026-11-13 00:35:29.983971+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (3, 's', 's@gmail.com', '$2a$12$rxBfteXv.sgEkQLYooO5JuLOE5FqDNbdTmOUEDigPj/nf7IsNxvzC', 'student', 'active', 0, NULL, '2026-11-11 18:55:07.876122+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (2, 'sj', 'jindamsriman777@gmail.com', '$2a$12$xYW8n5zqapmqG4ZOsfqCKOkjzHZtKyj/dz0xgTGdmJU18yeNwKPNm', 'faculty', 'active', 0, NULL, '2026-11-11 18:44:51.567849+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (82, 'Student Test 1794499059444', 'student_1794499059444@college.edu', '$2a$12$J/bAXJ2Vs6Y8/XPouBf4se9n3wmvUWiuLtqLPKLuT2DWftTgCWh6S', 'student', 'active', 0, NULL, '2026-11-12 21:27:40.009595+05:30', '2451-22-733-444', NULL, 'Computer Science & Engineering', NULL, '3rd Year - Sem 1', '+91 9876543210', NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (84, 'Google Scholar Test', 'google_1794499059444@univ.edu', '$2a$10$/0ygEE42Co7Eg7MPtIukP.bkhc3evXFUuoTi6OzpyIl1r3o8UQP4m', 'student', 'active', 0, NULL, '2026-11-12 21:27:40.699682+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'google', 'https://lh3.googleusercontent.com/test');
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (83, 'Dr. Professor 1794499059444', 'faculty_1794499059444@college.edu', '$2a$12$LhRhdFUXjoMgm7RGH9WVQuo.g.v6v5R11U8vPJB0PnLPmfi9sRwYi', 'faculty', 'active', 0, NULL, '2026-11-12 21:27:40.543267+05:30', NULL, 'FAC-CSE-444', 'Computer Science & Engineering', 'Associate Professor', NULL, '+91 9999999999', 'Cloud Computing & High-Concurrency Systems', 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (85, 'Dr. R. Sharma', 'dr.sharma@mvsrec.edu.in', '$2a$10$YcKPMU56Y7irzR0IqN1.0OhO7/QhdDeOYbGYC1Mr2GnNHhsmVYC0C', 'faculty', 'active', 0, NULL, '2026-11-12 21:41:50.545447+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'google', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (41, 'sr', 's1@gmail.com', '$2a$12$7cTSUUknkduICGdj0hi11Oi5AJOloN0znnJJPq3jYRGCOSL1fELLS', 'student', 'active', 0, NULL, '2026-11-12 19:44:37.606746+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (1, 'Admin', 'sriman_cse@mvsrec.edu.in', '$2a$12$91nURLQWwS.04kKBZwWsSOHofUdqXpC7CV2BA4ZVaJLM4nbEgb4JO', 'admin', 'active', 0, NULL, '2026-11-11 18:35:05.592239+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (87, 'Prof. Alice', 'alice_1794500751672@mvsrec.edu.in', '$2a$12$LKB67/BK6PAsEOeh81UGr.4LObKDU.UEkumt/5m4Yx7MODmlGKRDK', 'faculty', 'active', 0, NULL, '2026-11-12 21:55:52.109184+05:30', NULL, NULL, 'CSE', NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (43, 'NAGA SHIVA', 'shiva@gmail.com', '$2a$12$klUvHnqhfMbtQ3zlBpjcX./k.xFYvDZN/RE/GzivWkXU4rbT70EJS', 'faculty', 'active', 0, NULL, '2026-11-12 19:51:28.134044+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (44, 'SRK', 'srk@gmail.com', '$2a$12$lsWgGGUNXmSLRQJrtVtlO.fJ4EgaGunfce5Ue.Lq85GRt3NfVp5xC', 'faculty', 'active', 0, NULL, '2026-11-12 19:51:47.108252+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (88, 'Prof. Bob', 'bob_1794500751672@mvsrec.edu.in', '$2a$12$BNJbXQUJqCx4Q0noY41tSeMJhNPTz0PplPucjivgJteAnfsXZYRqW', 'faculty', 'active', 0, NULL, '2026-11-12 21:55:52.527868+05:30', NULL, NULL, 'ECE', NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (38, 'Dr. Robert Smith', 'robert.faculty@mvsrec.edu.in', '$2a$12$H9W4nM4vyyQJCyC8fSNImOXghTfJEoY9N99Qm8eZTUSZvrtx9T7Nm', 'faculty', 'active', 0, NULL, '2026-11-12 19:07:21.737079+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (39, 'Alice Wonder', 'alice.student@mvsrec.edu.in', '$2a$12$OGHDgISj1hu074OMDtMXOeNO9KU27WD9K/dEPmseXMeA4ooETcqcK', 'student', 'active', 0, NULL, '2026-11-12 19:08:04.685571+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);
INSERT INTO public.users (id, name, email, password_hash, role, status, failed_logins, locked_until, created_at, roll_number, employee_id, department, designation, year_sem, phone, specialization, auth_provider, avatar_url) VALUES (42, 'Prof. Python Specialist', 'sriman@gmail.com', '$2a$12$lSc0t42JKqP2XmIbZXHPWOv0RqA/hF5thELPd.k3slNeWwIjDn9KG', 'faculty', 'active', 0, NULL, '2026-11-12 19:51:04.354145+05:30', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', NULL);


--
-- Name: attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attempts_id_seq', 2, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 41, true);


--
-- Name: courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.courses_id_seq', 7, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.questions_id_seq', 57, true);


--
-- Name: tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tests_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 127, true);


--
-- Name: attempts attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (id);


--
-- Name: attempts attempts_test_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_test_id_student_id_key UNIQUE (test_id, student_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (course_id, student_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (attempt_id, question_id);


--
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (attempt_id);


--
-- Name: test_questions test_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_pkey PRIMARY KEY (test_id, question_id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: tests tests_share_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_share_code_key UNIQUE (share_code);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: attempts_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempts_deadline_idx ON public.attempts USING btree (deadline) WHERE (submitted_at IS NULL);


--
-- Name: attempts_test_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempts_test_id_idx ON public.attempts USING btree (test_id);


--
-- Name: questions_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_course_id_idx ON public.questions USING btree (course_id);


--
-- Name: attempts attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: attempts attempts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: courses courses_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: questions questions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: questions questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: responses responses_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.attempts(id) ON DELETE CASCADE;


--
-- Name: responses responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: results results_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.attempts(id);


--
-- Name: test_questions test_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: test_questions test_questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: tests tests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: tests tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

