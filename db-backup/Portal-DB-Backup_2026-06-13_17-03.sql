--
-- PostgreSQL database dump
--

\restrict LzDbSJXesYWgAQKHQbJw2ViiddHX8iKqS3ZfFEp6K1JfvOZaQYz9VHTg39vbPKD

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer,
    username text,
    user_full_name text,
    action_type text NOT NULL,
    entity_type text,
    entity_id text,
    invoice_number text,
    message text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at_jalali text NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO "Administrator";

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activity_logs_id_seq OWNER TO "Administrator";

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.app_users (
    id integer NOT NULL,
    username text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    password_hash text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    seller_lookup_id integer,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_users OWNER TO "Administrator";

--
-- Name: app_users_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.app_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.app_users_id_seq OWNER TO "Administrator";

--
-- Name: app_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.app_users_id_seq OWNED BY public.app_users.id;


--
-- Name: cities; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.cities (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.cities OWNER TO "Administrator";

--
-- Name: cities_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cities_id_seq OWNER TO "Administrator";

--
-- Name: cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.cities_id_seq OWNED BY public.cities.id;


--
-- Name: config_types; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.config_types (
    id integer NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.config_types OWNER TO "Administrator";

--
-- Name: config_types_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.config_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.config_types_id_seq OWNER TO "Administrator";

--
-- Name: config_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.config_types_id_seq OWNED BY public.config_types.id;


--
-- Name: device_models; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.device_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.device_models OWNER TO "Administrator";

--
-- Name: device_models_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.device_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.device_models_id_seq OWNER TO "Administrator";

--
-- Name: device_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.device_models_id_seq OWNED BY public.device_models.id;


--
-- Name: order_statuses; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.order_statuses (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.order_statuses OWNER TO "Administrator";

--
-- Name: order_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.order_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_statuses_id_seq OWNER TO "Administrator";

--
-- Name: order_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.order_statuses_id_seq OWNED BY public.order_statuses.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    priority integer DEFAULT 1,
    invoice_number character varying(100),
    quantity integer DEFAULT 1,
    device_model integer,
    seller_id integer,
    city_id integer,
    warehouse_id integer,
    order_date date DEFAULT CURRENT_DATE,
    description text,
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    buyer_name character varying(255),
    config_type character varying(50),
    seller_description text,
    technical_description text,
    serials text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    purchase_number text,
    warranty text,
    related_invoices text,
    created_at_jalali text,
    technical_notes jsonb DEFAULT '[]'::jsonb NOT NULL,
    seller_notes jsonb DEFAULT '[]'::jsonb NOT NULL,
    technician_assignments jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.orders OWNER TO "Administrator";

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO "Administrator";

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: sellers; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.sellers (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.sellers OWNER TO "Administrator";

--
-- Name: sellers_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.sellers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sellers_id_seq OWNER TO "Administrator";

--
-- Name: sellers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.sellers_id_seq OWNED BY public.sellers.id;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.warehouses (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.warehouses OWNER TO "Administrator";

--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warehouses_id_seq OWNER TO "Administrator";

--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;


--
-- Name: warranties; Type: TABLE; Schema: public; Owner: Administrator
--

CREATE TABLE public.warranties (
    id integer NOT NULL,
    name text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.warranties OWNER TO "Administrator";

--
-- Name: warranties_id_seq; Type: SEQUENCE; Schema: public; Owner: Administrator
--

CREATE SEQUENCE public.warranties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranties_id_seq OWNER TO "Administrator";

--
-- Name: warranties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Administrator
--

ALTER SEQUENCE public.warranties_id_seq OWNED BY public.warranties.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: app_users id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.app_users ALTER COLUMN id SET DEFAULT nextval('public.app_users_id_seq'::regclass);


--
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_id_seq'::regclass);


--
-- Name: config_types id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.config_types ALTER COLUMN id SET DEFAULT nextval('public.config_types_id_seq'::regclass);


--
-- Name: device_models id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.device_models ALTER COLUMN id SET DEFAULT nextval('public.device_models_id_seq'::regclass);


--
-- Name: order_statuses id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.order_statuses ALTER COLUMN id SET DEFAULT nextval('public.order_statuses_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: sellers id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.sellers ALTER COLUMN id SET DEFAULT nextval('public.sellers_id_seq'::regclass);


--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);


--
-- Name: warranties id; Type: DEFAULT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.warranties ALTER COLUMN id SET DEFAULT nextval('public.warranties_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.activity_logs (id, user_id, username, user_full_name, action_type, entity_type, entity_id, invoice_number, message, details, created_at, created_at_jalali) FROM stdin;
\.


--
-- Data for Name: app_users; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.app_users (id, username, full_name, role, roles, password_hash, permissions, is_active, seller_lookup_id, display_order, created_at, updated_at) FROM stdin;
1	administrator	ادمین سیستم	admin	["admin"]	pbkdf2$120000$sha256$6e8643b589a3aaad6cf0a5ae89f427b8$8adc511b68b0982a2bf81eacbed52390b530da10e3230e32ffb3923c215674b5	{"logs.view": true, "menus.home": true, "menus.logs": true, "users.view": true, "menus.users": true, "orders.view": true, "archive.view": true, "lookups.view": true, "reports.view": true, "users.create": true, "users.delete": true, "users.update": true, "menus.account": true, "menus.archive": true, "menus.lookups": true, "menus.reports": true, "orders.create": true, "orders.delete": true, "orders.update": true, "lookups.create": true, "lookups.delete": true, "lookups.update": true, "orders.related": true, "orders.serials": true, "users.priority": true, "orders.priority": true, "lookups.priority": true, "orders.technical": true, "users.permissions": true, "orders.sales_notes": true, "account.change_password": true}	t	\N	1	2026-06-13 16:11:35.995562+03:30	2026-06-13 16:11:35.995562+03:30
2	s.esfahani	سامان اصفهانی	technician	["technician"]	pbkdf2$120000$sha256$5863dd62eaf49cfc222f72a26db0cf09$8701e60d0bd25ff56e3784e50d408e9608aade580c509fae4591248d1761e4e2	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": false, "orders.delete": true, "orders.update": true, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": false, "orders.serials": true, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": true, "users.permissions": false, "orders.sales_notes": false, "account.change_password": true}	t	\N	1	2026-06-13 16:30:45.445704+03:30	2026-06-13 16:35:27.469713+03:30
3	a.moeini	عباس معینی	technician	["technician"]	pbkdf2$120000$sha256$d50785d0bb38b35736353373e33a671e$ea38ef6ae510fda807aafc388eb0519db78f53a106bf0dfdb97c07e5c4d8393d	{"logs.view": true, "menus.home": true, "menus.logs": true, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": false, "orders.delete": true, "orders.update": true, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": false, "orders.serials": true, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": true, "users.permissions": false, "orders.sales_notes": false, "account.change_password": true}	t	\N	2	2026-06-13 16:31:40.345572+03:30	2026-06-13 16:36:23.747969+03:30
4	m.almasi	محمد الماسی	technician	["technician"]	pbkdf2$120000$sha256$784f0fedcc9a9a37a75c37b742dfdf28$2e2ad177a6aae8f50c4e9715784cd837ad856d103e0d9810b63373f20827972f	{"logs.view": true, "menus.home": true, "menus.logs": true, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": false, "orders.delete": true, "orders.update": true, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": false, "orders.serials": true, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": true, "users.permissions": false, "orders.sales_notes": false, "account.change_password": true}	t	\N	3	2026-06-13 16:32:12.826526+03:30	2026-06-13 16:32:12.826526+03:30
5	m.sardashti	مهرداد سردشتی	sales	["sales"]	pbkdf2$120000$sha256$02ede5655a6d7d1ff15ddf14435fe6e8$2beed7603ecdb72a7a53097bdd6e56d36360c421b23cd28a19e9638ad12c31b7	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": true, "orders.delete": false, "orders.update": false, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": true, "orders.serials": false, "users.priority": false, "orders.priority": true, "lookups.priority": false, "orders.technical": false, "users.permissions": false, "orders.sales_notes": true, "account.change_password": true}	t	2	1	2026-06-13 16:32:41.365235+03:30	2026-06-13 16:32:41.365235+03:30
6	n.shams	ندا شمس	sales	["sales"]	pbkdf2$120000$sha256$6f31785a761886f1f4ead04494205531$787075be42ecaa093034a25a5b70609292818e44f7ba0acd51f2235d12e5e04f	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": true, "orders.delete": false, "orders.update": false, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": true, "orders.serials": false, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": false, "users.permissions": false, "orders.sales_notes": true, "account.change_password": true}	t	3	2	2026-06-13 16:33:25.794572+03:30	2026-06-13 16:33:25.794572+03:30
7	k.borjian	کمال برجیان	sales	["sales"]	pbkdf2$120000$sha256$bfd5275fc5477731cb2c32ed13bc7059$93199df861d2b178b1abe87b2b061a56477b45c043f29c988f4a53c60df1a2f3	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": true, "orders.delete": false, "orders.update": false, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": true, "orders.serials": false, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": false, "users.permissions": false, "orders.sales_notes": true, "account.change_password": true}	t	4	3	2026-06-13 16:33:51.498639+03:30	2026-06-13 16:33:51.498639+03:30
8	m.khadem	محمد خادم	sales	["sales"]	pbkdf2$120000$sha256$3b8cb6920a8e83d2547e15aa968e2f96$371828b65ce45c2a95e4c4c0b808eb67249756d5d0f694ed96a5df00ebba592a	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": true, "orders.delete": false, "orders.update": false, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": true, "orders.serials": false, "users.priority": false, "orders.priority": true, "lookups.priority": false, "orders.technical": false, "users.permissions": false, "orders.sales_notes": true, "account.change_password": true}	t	5	4	2026-06-13 16:34:21.018058+03:30	2026-06-13 16:34:21.018058+03:30
9	m.tohidi	مهسا توحیدی	sales	["sales"]	pbkdf2$120000$sha256$0bec439a842917476060837e4a4a6d18$3a69027b5d106e5021adcdd5b9ce7b26de13836fe8e0121cb08230a43a346873	{"logs.view": false, "menus.home": true, "menus.logs": false, "users.view": false, "menus.users": false, "orders.view": true, "archive.view": true, "lookups.view": false, "reports.view": true, "users.create": false, "users.delete": false, "users.update": false, "menus.account": true, "menus.archive": true, "menus.lookups": false, "menus.reports": true, "orders.create": true, "orders.delete": false, "orders.update": false, "lookups.create": false, "lookups.delete": false, "lookups.update": false, "orders.related": true, "orders.serials": false, "users.priority": false, "orders.priority": false, "lookups.priority": false, "orders.technical": false, "users.permissions": false, "orders.sales_notes": true, "account.change_password": true}	t	6	5	2026-06-13 16:34:45.330827+03:30	2026-06-13 16:34:45.330827+03:30
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.cities (id, name, display_order, is_active) FROM stdin;
2	تهران	1	t
3	شهرستان	2	t
\.


--
-- Data for Name: config_types; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.config_types (id, name, display_order, is_active) FROM stdin;
2	Base	1	t
3	Config	2	t
\.


--
-- Data for Name: device_models; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.device_models (id, name, display_order, is_active) FROM stdin;
2	DL360 Gen9 8SFF (Used)	1	t
3	DL360 Gen9 4LFF (Used)	2	t
4	DL380 Gen9 8SFF (Used)	3	t
5	DL380 Gen9 12LFF (Used)	4	t
6	DL360 Gen10 8SFF (New)	5	t
7	DL360 Gen10 8SFF (Used)	6	t
8	DL360 Gen10 4LFF (New)	7	t
9	DL360 Gen10 4LFF (Used)	8	t
10	DL380 Gen10 8SFF (New)	9	t
11	DL380 Gen10 8SFF (Used)	10	t
12	DL380 Gen10 12LFF (New)	11	t
14	DL380 Gen11 8SFF (New)	13	t
15	DL380 Gen11 12LFF (New)	14	t
16	MSA 2060	15	t
17	MSA 2062	16	t
18	MSA 2070	17	t
19	MSA 2072	18	t
13	DL380 Gen10 12LFF (Used)	12	t
\.


--
-- Data for Name: order_statuses; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.order_statuses (id, code, name) FROM stdin;
1	Pending	در انتظار انجام
2	Waiting-Goods	در انتظار دریافت کالا
3	In-Progress	در حال انجام
4	Cancelled	کنسل شده
5	Returned	برگشت خورده
6	Completed	تکمیل شده
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.orders (id, priority, invoice_number, quantity, device_model, seller_id, city_id, warehouse_id, order_date, description, status, created_at, buyer_name, config_type, seller_description, technical_description, serials, updated_at, purchase_number, warranty, related_invoices, created_at_jalali, technical_notes, seller_notes, technician_assignments) FROM stdin;
\.


--
-- Data for Name: sellers; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.sellers (id, name, display_order, is_active) FROM stdin;
2	مهرداد سردشتی	0	t
3	ندا شمس	0	t
4	کمال برجیان	0	t
5	محمد خادم	0	t
6	مهسا توحیدی	0	t
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.warehouses (id, name, display_order, is_active) FROM stdin;
2	رودسر	1	t
3	آفتاب	2	t
4	داخلی	3	t
\.


--
-- Data for Name: warranties; Type: TABLE DATA; Schema: public; Owner: Administrator
--

COPY public.warranties (id, name, display_order, is_active) FROM stdin;
2	3 ماه	1	t
3	6 ماه	2	t
4	12 ماه	3	t
\.


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 1, false);


--
-- Name: app_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.app_users_id_seq', 9, true);


--
-- Name: cities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.cities_id_seq', 3, true);


--
-- Name: config_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.config_types_id_seq', 3, true);


--
-- Name: device_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.device_models_id_seq', 19, true);


--
-- Name: order_statuses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.order_statuses_id_seq', 6, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: sellers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.sellers_id_seq', 6, true);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.warehouses_id_seq', 4, true);


--
-- Name: warranties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Administrator
--

SELECT pg_catalog.setval('public.warranties_id_seq', 4, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_username_key; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_username_key UNIQUE (username);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: config_types config_types_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.config_types
    ADD CONSTRAINT config_types_pkey PRIMARY KEY (id);


--
-- Name: device_models device_models_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.device_models
    ADD CONSTRAINT device_models_pkey PRIMARY KEY (id);


--
-- Name: order_statuses order_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.order_statuses
    ADD CONSTRAINT order_statuses_code_key UNIQUE (code);


--
-- Name: order_statuses order_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.order_statuses
    ADD CONSTRAINT order_statuses_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: sellers sellers_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: warranties warranties_pkey; Type: CONSTRAINT; Schema: public; Owner: Administrator
--

ALTER TABLE ONLY public.warranties
    ADD CONSTRAINT warranties_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_created_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX activity_logs_created_idx ON public.activity_logs USING btree (created_at DESC);


--
-- Name: activity_logs_invoice_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX activity_logs_invoice_idx ON public.activity_logs USING btree (invoice_number);


--
-- Name: activity_logs_jalali_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX activity_logs_jalali_idx ON public.activity_logs USING btree (created_at_jalali);


--
-- Name: activity_logs_user_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX activity_logs_user_idx ON public.activity_logs USING btree (user_id);


--
-- Name: app_users_role_active_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX app_users_role_active_idx ON public.app_users USING btree (role, is_active);


--
-- Name: app_users_role_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX app_users_role_order_idx ON public.app_users USING btree (role, display_order);


--
-- Name: cities_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX cities_display_order_idx ON public.cities USING btree (display_order, id);


--
-- Name: cities_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX cities_name_unique_idx ON public.cities USING btree (name);


--
-- Name: config_types_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX config_types_display_order_idx ON public.config_types USING btree (display_order, id);


--
-- Name: config_types_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX config_types_name_unique_idx ON public.config_types USING btree (name);


--
-- Name: device_models_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX device_models_display_order_idx ON public.device_models USING btree (display_order, id);


--
-- Name: device_models_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX device_models_name_unique_idx ON public.device_models USING btree (name);


--
-- Name: sellers_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX sellers_display_order_idx ON public.sellers USING btree (display_order, id);


--
-- Name: sellers_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX sellers_name_unique_idx ON public.sellers USING btree (name);


--
-- Name: warehouses_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX warehouses_display_order_idx ON public.warehouses USING btree (display_order, id);


--
-- Name: warehouses_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX warehouses_name_unique_idx ON public.warehouses USING btree (name);


--
-- Name: warranties_display_order_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE INDEX warranties_display_order_idx ON public.warranties USING btree (display_order, id);


--
-- Name: warranties_name_unique_idx; Type: INDEX; Schema: public; Owner: Administrator
--

CREATE UNIQUE INDEX warranties_name_unique_idx ON public.warranties USING btree (name);


--
-- PostgreSQL database dump complete
--

\unrestrict LzDbSJXesYWgAQKHQbJw2ViiddHX8iKqS3ZfFEp6K1JfvOZaQYz9VHTg39vbPKD

