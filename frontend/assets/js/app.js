// Extracted from index.html to keep the frontend maintainable.
const API_URL = '/api';

        const AUTH_TOKEN_KEY = 'server_portal_auth_token';

        function getStoredAuthToken() {
            return localStorage.getItem(AUTH_TOKEN_KEY) || '';
        }

        function persistAuthToken(token) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        }

        function clearAuthToken() {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }

        let authToken = getStoredAuthToken();
        let currentUser = null;
        const DEFAULT_SECURITY_ROLES = [
            { code: 'admin', name: 'ادمین' },
            { code: 'technician', name: 'تکنسین فنی' },
            { code: 'sales', name: 'کارشناس فروش' }
        ];
        const DEFAULT_SECURITY_PERMISSIONS = [
            { code: 'menus.home', name: 'نمایش منوی صفحه اصلی', group: 'منوها' },
            { code: 'menus.users', name: 'نمایش منوی مدیریت کاربران', group: 'منوها' },
            { code: 'menus.lookups', name: 'نمایش منوی مدیریت اطلاعات پایه', group: 'منوها' },
            { code: 'menus.archive', name: 'نمایش منوی بایگانی', group: 'منوها' },
            { code: 'menus.reports', name: 'نمایش منوی گزارش ها', group: 'منوها' },
            { code: 'menus.logs', name: 'نمایش منوی فعالیت ها', group: 'منوها' },
            { code: 'menus.account', name: 'نمایش منوی تنظیمات حساب کاربری', group: 'منوها' },
            { code: 'orders.view', name: 'مشاهده فاکتورها', group: 'فاکتورها' },
            { code: 'orders.create', name: 'ثبت فاکتور جدید', group: 'فاکتورها' },
            { code: 'orders.update', name: 'ویرایش اطلاعات اصلی فاکتور', group: 'فاکتورها' },
            { code: 'orders.delete', name: 'حذف فاکتور', group: 'فاکتورها' },
            { code: 'orders.priority', name: 'جابجایی اولویت فاکتور', group: 'فاکتورها' },
            { code: 'orders.technical', name: 'مدیریت وضعیت، توضیحات فنی و تکنسین‌ها', group: 'فاکتورها' },
            { code: 'orders.serials', name: 'مدیریت سریال‌ها', group: 'فاکتورها' },
            { code: 'orders.sales_notes', name: 'مدیریت توضیحات فروشنده', group: 'فاکتورها' },
            { code: 'orders.related', name: 'مدیریت فاکتورهای وابسته', group: 'فاکتورها' },
            { code: 'archive.view', name: 'مشاهده بایگانی فاکتورها', group: 'بایگانی' },
            { code: 'reports.view', name: 'مشاهده گزارش ها', group: 'گزارش ها' },
            { code: 'logs.view', name: 'مشاهده فعالیت کاربران', group: 'فعالیت ها' },
            { code: 'account.change_password', name: 'تغییر رمز عبور خود کاربر', group: 'تنظیمات حساب کاربری' },
            { code: 'users.view', name: 'مشاهده کاربران', group: 'مدیریت کاربران' },
            { code: 'users.create', name: 'ساخت کاربر', group: 'مدیریت کاربران' },
            { code: 'users.update', name: 'ویرایش کاربر', group: 'مدیریت کاربران' },
            { code: 'users.delete', name: 'حذف / غیرفعال‌سازی کاربر', group: 'مدیریت کاربران' },
            { code: 'users.permissions', name: 'تعیین دسترسی‌های کاربر', group: 'مدیریت کاربران' },
            { code: 'users.priority', name: 'جابه‌جایی ترتیب کاربران', group: 'مدیریت کاربران' },
            { code: 'lookups.view', name: 'مشاهده اطلاعات پایه', group: 'اطلاعات پایه' },
            { code: 'lookups.create', name: 'افزودن اطلاعات پایه', group: 'اطلاعات پایه' },
            { code: 'lookups.update', name: 'ویرایش اطلاعات پایه', group: 'اطلاعات پایه' },
            { code: 'lookups.delete', name: 'حذف / غیرفعال‌سازی اطلاعات پایه', group: 'اطلاعات پایه' },
            { code: 'lookups.priority', name: 'جابه‌جایی ترتیب اطلاعات پایه', group: 'اطلاعات پایه' }
        ];
        const DEFAULT_ALL_PERMISSIONS = DEFAULT_SECURITY_PERMISSIONS.reduce((acc, item) => ({ ...acc, [item.code]: true }), {});
        const DEFAULT_SECURITY_ROLE_DEFAULTS = {
            admin: DEFAULT_ALL_PERMISSIONS,
            technician: {
                'menus.home': true,
                'menus.archive': true,
                'menus.account': true,
                'orders.view': true,
                'archive.view': true,
                'account.change_password': true
            },
            sales: {
                'menus.home': true,
                'menus.archive': true,
                'menus.account': true,
                'orders.view': true,
                'archive.view': true,
                'account.change_password': true
            }
        };
        let securityCatalog = {
            roles: DEFAULT_SECURITY_ROLES,
            permissions: DEFAULT_SECURITY_PERMISSIONS,
            role_defaults: DEFAULT_SECURITY_ROLE_DEFAULTS
        };
        let allUsers = [];
        let activePage = 'home';
        let editingUserId = '';
        let ordersAutoRefreshTimer = null;
        let refreshInProgress = false;
        let lastRefreshAt = null;
        const homeGroupState = {};
        const archiveGroupState = {};
        const activityGroupState = {};
        const openLogDetailRows = new Set();

        function hasPermission(code) {
            if (!currentUser) return false;
            return Boolean((currentUser.permissions || {})[code]);
        }

        function requireClientPermission(code, message = 'شما دسترسی لازم برای این عملیات را ندارید.') {
            if (!hasPermission(code)) {
                showAppToast(message);
                return false;
            }
            return true;
        }

        async function apiFetch(url, options = {}) {
            const headers = new Headers(options.headers || {});
            if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401) {
                logout(false);
                throw new Error('نشست شما منقضی شده است. دوباره وارد شوید.');
            }
            return response;
        }

        function setLoginError(message) {
            const box = document.getElementById('loginError');
            if (!box) return;
            box.innerText = message || '';
            box.style.display = message ? 'block' : 'none';
        }


        function clearFormFields(root) {
            const container = typeof root === 'string' ? document.getElementById(root) : root;
            if (!container) return;
            container.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                else el.value = '';
            });
        }

        function clearLoginForm() {
            const form = document.getElementById('loginForm');
            if (form) form.reset();
            const username = document.getElementById('loginUsername');
            const password = document.getElementById('loginPassword');
            if (username) username.value = '';
            if (password) password.value = '';
            setLoginError('');
        }

        function clearOrderFormState() {
            const form = document.getElementById('orderForm');
            if (form) form.reset();
            relInvoices = [];
            if (typeof renderRelInvoices === 'function') renderRelInvoices();
            if (typeof toggleWarehouseLogic === 'function') toggleWarehouseLogic();
        }

        function clearModalInputs(modalId) {
            clearFormFields(modalId);
        }

        async function handleLogin(event) {
            event.preventDefault();
            setLoginError('');
            const btn = document.getElementById('loginBtn');
            const original = btn.innerText;
            btn.innerText = 'در حال ورود...';
            btn.disabled = true;

            try {
                const username = document.getElementById('loginUsername').value.trim();
                const password = document.getElementById('loginPassword').value;
                if (!username || !password) {
                    setLoginError('نام کاربری و رمز عبور الزامی است.');
                    return;
                }
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (!res.ok) {
                    setLoginError(data.error || 'خطا در ورود');
                    return;
                }
                authToken = data.token;
                currentUser = data.user;
                persistAuthToken(authToken);
                clearLoginForm();
                await enterApplication();
            } catch (err) {
                setLoginError('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = original;
                btn.disabled = false;
            }
        }

        async function loadCurrentUser() {
            if (!authToken) return false;
            try {
                const res = await apiFetch(`${API_URL}/auth/me`);
                if (!res.ok) return false;
                const data = await res.json();
                currentUser = data.user;
                return true;
            } catch (err) {
                return false;
            }
        }

        async function enterApplication() {
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('appShell').style.display = 'block';
            applySecurityUI();
            showPage('home');
            await loadSecurityCatalog();
            await loadMetadata();
            await loadOrders();
            updateLastRefreshTime();
            setupOrdersAutoRefresh();
        }

        function logout(clearToken = true) {
            stopOrdersAutoRefresh();
            clearLoginForm();
            clearFormFields(document.getElementById('appShell'));
            if (clearToken) clearAuthToken();
            authToken = '';
            currentUser = null;
            const app = document.getElementById('appShell');
            const login = document.getElementById('loginPage');
            const floating = document.getElementById('floatingAddBtn');
            if (app) app.style.display = 'none';
            if (login) login.style.display = 'flex';
            if (floating) floating.style.display = 'none';
        }

        async function initApp() {
            const ok = await loadCurrentUser();
            if (ok) {
                await enterApplication();
            } else {
                logout(false);
            }
        }

        function setVisibleByPermission(elementId, permission) {
            const el = document.getElementById(elementId);
            if (el) el.style.display = hasPermission(permission) ? '' : 'none';
        }

        function applySecurityUI() {
            const userPill = document.getElementById('currentUserPill');
            if (userPill && currentUser) {
                userPill.innerText = currentUser.full_name || 'کاربر';
            }
            const rolePill = document.getElementById('currentUserRolePill');
            if (rolePill && currentUser) {
                rolePill.innerText = currentUser.role_names || currentUser.role_name || roleLabel(currentUser.role) || 'نقش';
            }
            updateFloatingAction(activePage || 'home');
            setVisibleByPermission('navUsersBtn', 'menus.users');
            setVisibleByPermission('navLookupsBtn', 'menus.lookups');
            setVisibleByPermission('navArchiveBtn', 'menus.archive');
            setVisibleByPermission('navReportsBtn', 'menus.reports');
            setVisibleByPermission('navLogsBtn', 'menus.logs');
            setVisibleByPermission('navAccountBtn', 'menus.account');
        }



        function formatLastRefreshClock(dateValue = new Date()) {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            const pad = value => String(value).padStart(2, '0');
            return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        }

        function updateLastRefreshTime(dateValue = new Date()) {
            lastRefreshAt = dateValue instanceof Date ? dateValue : new Date(dateValue);
            const el = document.getElementById('lastRefreshTime');
            if (el) el.innerText = formatLastRefreshClock(lastRefreshAt);
        }

        function setManualRefreshLoading(isLoading) {
            const btn = document.getElementById('manualRefreshBtn');
            if (!btn) return;
            btn.disabled = Boolean(isLoading);
            btn.classList.toggle('is-loading', Boolean(isLoading));
        }

        async function handleManualRefresh() {
            if (!currentUser || !authToken || refreshInProgress) return;
            setManualRefreshLoading(true);
            try {
                await refreshPageData(activePage || 'home');
            } finally {
                setManualRefreshLoading(false);
            }
        }

        function handleFloatingAction() {
            if (activePage === 'users') {
                openCreateUserModal();
                return;
            }
            if (activePage === 'home') {
                openOrderModal();
            }
        }

        function updateFloatingAction(page = activePage) {
            activePage = page || 'home';
            const floating = document.getElementById('floatingAddBtn');
            if (!floating || !currentUser) return;

            if (activePage === 'users') {
                if (hasPermission('users.create')) {
                    floating.innerText = '+ کاربر جدید';
                    floating.style.display = '';
                } else {
                    floating.style.display = 'none';
                }
                return;
            }

            if (activePage === 'home' && hasPermission('orders.create')) {
                floating.innerText = '+ فاکتور جدید';
                floating.style.display = '';
            } else {
                floating.style.display = 'none';
            }
        }

        function showPage(page) {
            const pagePermissions = {
                users: 'users.view',
                lookups: 'lookups.view',
                archive: 'archive.view',
                reports: 'reports.view',
                logs: 'logs.view',
                account: 'account.change_password'
            };
            const required = pagePermissions[page];
            if (required && !hasPermission(required)) {
                showAppToast('شما دسترسی مشاهده این بخش را ندارید.');
                page = 'home';
            }

            activePage = page;
            ['home', 'users', 'lookups', 'archive', 'reports', 'logs', 'account'].forEach(name => {
                const section = document.getElementById(`${name}Page`);
                if (section) section.classList.toggle('hidden', page !== name);
            });

            const navMap = {
                home: 'navHomeBtn',
                users: 'navUsersBtn',
                lookups: 'navLookupsBtn',
                archive: 'navArchiveBtn',
                reports: 'navReportsBtn',
                logs: 'navLogsBtn',
                account: 'navAccountBtn'
            };
            Object.entries(navMap).forEach(([name, id]) => {
                const btn = document.getElementById(id);
                if (btn) btn.classList.toggle('active-page', page === name);
            });

            const searchWrap = document.getElementById('globalSearchWrap');
            if (searchWrap) searchWrap.style.display = page === 'home' ? '' : 'none';
            updateFloatingAction(page);

            refreshPageData(page);
        }

        async function refreshPageData(page = activePage) {
            if (!currentUser || !authToken) return;
            if (refreshInProgress) return;
            refreshInProgress = true;
            let refreshed = false;
            try {
                if (page === 'home') { await loadOrders(); refreshed = true; }
                if (page === 'users') { await loadUsers(); refreshed = true; }
                if (page === 'lookups') { await loadLookups(lookupActiveType); refreshed = true; }
                if (page === 'archive') {
                    await loadOrders();
                    renderArchive();
                    refreshed = true;
                }
                if (page === 'reports') {
                    await initializeReportsPage();
                    refreshed = true;
                }
                if (page === 'logs') {
                    await loadActivityLogUsers();
                    await loadActivityLogs();
                    refreshed = true;
                }
                if (page === 'account') { renderAccountSettings(); refreshed = true; }
                if (refreshed) updateLastRefreshTime();
            } finally {
                refreshInProgress = false;
            }
        }

        function normalizeSecurityCatalog(data = {}) {
            const roles = Array.isArray(data.roles) && data.roles.length ? data.roles : DEFAULT_SECURITY_ROLES;
            const permissions = Array.isArray(data.permissions) && data.permissions.length ? data.permissions : DEFAULT_SECURITY_PERMISSIONS;
            const roleDefaults = data.role_defaults && typeof data.role_defaults === 'object' ? data.role_defaults : DEFAULT_SECURITY_ROLE_DEFAULTS;
            return {
                roles,
                permissions,
                role_defaults: {
                    ...DEFAULT_SECURITY_ROLE_DEFAULTS,
                    ...roleDefaults
                }
            };
        }

        function getSecurityRoles() {
            return Array.isArray(securityCatalog.roles) && securityCatalog.roles.length ? securityCatalog.roles : DEFAULT_SECURITY_ROLES;
        }

        function getSecurityPermissions() {
            return Array.isArray(securityCatalog.permissions) && securityCatalog.permissions.length ? securityCatalog.permissions : DEFAULT_SECURITY_PERMISSIONS;
        }

        function getSecurityRoleDefaults() {
            return securityCatalog.role_defaults && typeof securityCatalog.role_defaults === 'object' ? securityCatalog.role_defaults : DEFAULT_SECURITY_ROLE_DEFAULTS;
        }

        async function loadSecurityCatalog() {
            if (!hasPermission('users.view')) {
                securityCatalog = normalizeSecurityCatalog(securityCatalog);
                return false;
            }
            try {
                const res = await apiFetch(`${API_URL}/security/catalog?_=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                    securityCatalog = normalizeSecurityCatalog(await res.json());
                    renderPermissionGrid();
                    return true;
                }
            } catch (e) {
                console.error(e);
            }
            securityCatalog = normalizeSecurityCatalog(securityCatalog);
            renderPermissionGrid();
            return false;
        }

        function roleLabel(role) {
            const found = getSecurityRoles().find(item => item.code === role);
            if (found) return found.name;
            if (role === 'admin') return 'ادمین';
            if (role === 'technician') return 'تکنسین فنی';
            if (role === 'sales') return 'کارشناس فروش';
            return role || '-';
        }


        function normalizeClientRoles(input = []) {
            const allowed = getSecurityRoles().map(item => item.code);
            const source = Array.isArray(input) ? input : [input].filter(Boolean);
            const roles = source.filter(role => allowed.includes(role));
            return roles.length ? [...new Set(roles)] : ['sales'];
        }

        function getUserRoles(user = {}) {
            return normalizeClientRoles(user.roles && user.roles.length ? user.roles : [user.role || 'sales']);
        }

        function getSelectedRolesFromForm() {
            const selected = Array.from(document.querySelectorAll('[data-user-role-code]:checked')).map(input => input.getAttribute('data-user-role-code'));
            return normalizeClientRoles(selected);
        }

        function buildRoleDefaults(roles = ['sales']) {
            const output = {};
            normalizeClientRoles(roles).forEach(role => {
                const defaults = getSecurityRoleDefaults()?.[role] || {};
                Object.entries(defaults).forEach(([code, value]) => {
                    if (value) output[code] = true;
                    else if (!Object.prototype.hasOwnProperty.call(output, code)) output[code] = false;
                });
            });
            return output;
        }

        function renderRoleCheckboxes(selectedRoles = ['sales']) {
            const grid = document.getElementById('userRolesGrid');
            if (!grid) return;
            const roles = getSecurityRoles();
            const selected = new Set(normalizeClientRoles(selectedRoles));
            grid.innerHTML = roles.map(role => `
                <label class="permission-item">
                    <span>
                        <b>${escapeHtml(role.name)}</b>
                        <small>${escapeHtml(role.code)}</small>
                    </span>
                    <input type="checkbox" data-user-role-code="${escapeAttr(role.code)}" ${selected.has(role.code) ? 'checked' : ''} onchange="applyRoleDefaultsToForm()">
                </label>
            `).join('');
        }

        function getPermissionCategory(item = {}) {
            const code = String(item.code || '');
            if (code.startsWith('menus.')) return 'منوها';
            if (['orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.priority'].includes(code)) return 'فاکتورها';
            if (['orders.technical', 'orders.serials', 'orders.sales_notes', 'orders.related'].includes(code)) return 'عملیات فاکتور';
            if (code.startsWith('archive.')) return 'بایگانی';
            if (code.startsWith('reports.')) return 'گزارش‌ها';
            if (code.startsWith('logs.')) return 'فعالیت‌ها';
            if (code.startsWith('account.')) return 'حساب کاربری';
            if (code.startsWith('users.')) return 'مدیریت کاربران';
            return item.group || 'سایر دسترسی‌ها';
        }

        function renderPermissionGrid(selectedPermissions = null) {
            const grid = document.getElementById('permissionsGrid');
            if (!grid) return;
            const permissions = getSecurityPermissions();
            if (!permissions.length) {
                grid.innerHTML = '<div class="mini-empty-state">کاتالوگ دسترسی‌ها دریافت نشده است.</div>';
                return;
            }
            const roles = getSelectedRolesFromForm();
            const defaults = buildRoleDefaults(roles);
            const values = selectedPermissions || defaults;
            const categoryOrder = ['منوها', 'فاکتورها', 'عملیات فاکتور', 'بایگانی', 'گزارش‌ها', 'فعالیت‌ها', 'حساب کاربری', 'مدیریت کاربران', 'اطلاعات پایه', 'سایر دسترسی‌ها'];
            const grouped = {};
            permissions.forEach(item => {
                const category = getPermissionCategory(item);
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(item);
            });
            const orderedCategories = categoryOrder.filter(category => grouped[category]?.length)
                .concat(Object.keys(grouped).filter(category => !categoryOrder.includes(category)));

            grid.innerHTML = `
                <div class="permission-category-grid">
                    ${orderedCategories.map(category => `
                        <div class="permission-category-card">
                            <div class="permission-category-head">
                                <span>${escapeHtml(category)}</span>
                                <span class="permission-category-count">${grouped[category].length}</span>
                            </div>
                            <div class="permission-category-items">
                                ${grouped[category].map(item => `
                                    <label class="permission-item">
                                        <span>
                                            <b>${escapeHtml(item.name)}</b>
                                            <small>${escapeHtml(item.code)}</small>
                                        </span>
                                        <input type="checkbox" data-permission-code="${escapeAttr(item.code)}" ${values[item.code] ? 'checked' : ''}>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function getPermissionsFromForm() {
            const output = {};
            document.querySelectorAll('[data-permission-code]').forEach(input => {
                output[input.getAttribute('data-permission-code')] = input.checked;
            });
            return output;
        }

        function applyRoleDefaultsToForm() {
            const roles = getSelectedRolesFromForm();
            renderPermissionGrid(buildRoleDefaults(roles));
        }

        function openUserModal() {
            const modal = document.getElementById('userModal');
            if (modal) modal.style.display = 'flex';
        }

        function closeUserModal() {
            const modal = document.getElementById('userModal');
            if (modal) modal.style.display = 'none';
            resetUserForm();
        }

        async function openCreateUserModal() {
            if (!requireClientPermission('users.create')) return;
            await loadSecurityCatalog();
            resetUserForm();
            openUserModal();
        }

        function resetUserForm() {
            editingUserId = '';
            document.getElementById('userFormTitle').innerText = 'ساخت کاربر جدید';
            document.getElementById('userFormSubtitle').innerText = 'اطلاعات کاربر و سطح دسترسی‌ها را تنظیم کنید.';
            document.getElementById('user_id').value = '';
            document.getElementById('user_full_name').value = '';
            document.getElementById('user_username').value = '';
            document.getElementById('user_username').disabled = false;
            document.getElementById('user_password').value = '';
            document.getElementById('user_password').required = true;
            document.getElementById('user_password').placeholder = 'برای کاربر جدید الزامی است - حداقل ۴ کاراکتر';
            const passwordWrap = document.getElementById('userPasswordFieldWrap');
            if (passwordWrap) passwordWrap.style.display = '';
            renderRoleCheckboxes(['sales']);
            document.getElementById('user_is_active').checked = true;
            const deleteBtn = document.getElementById('userDeleteInModalBtn');
            if (deleteBtn) deleteBtn.style.display = 'none';
            applyRoleDefaultsToForm();
        }

        async function editUser(userId) {
            if (!requireClientPermission('users.update')) return;
            await loadSecurityCatalog();
            const user = allUsers.find(item => String(item.id) === String(userId));
            if (!user) return;
            editingUserId = String(user.id);
            document.getElementById('userFormTitle').innerText = `مدیریت کاربر ${user.full_name}`;
            document.getElementById('userFormSubtitle').innerText = 'نام کاربری، دسته‌ها، رمز عبور، وضعیت و سطح دسترسی کاربر را مدیریت کنید.';
            document.getElementById('user_id').value = user.id;
            document.getElementById('user_full_name').value = user.full_name || '';
            document.getElementById('user_username').value = user.username || '';
            document.getElementById('user_username').disabled = false;
            document.getElementById('user_password').value = '';
            document.getElementById('user_password').required = false;
            document.getElementById('user_password').placeholder = 'برای تغییر رمز، رمز جدید را وارد کنید - حداقل ۴ کاراکتر';
            const passwordWrap = document.getElementById('userPasswordFieldWrap');
            if (passwordWrap) passwordWrap.style.display = '';
            renderRoleCheckboxes(getUserRoles(user));
            document.getElementById('user_is_active').checked = Boolean(user.is_active);
            const deleteBtn = document.getElementById('userDeleteInModalBtn');
            if (deleteBtn) deleteBtn.style.display = hasPermission('users.delete') ? '' : 'none';
            renderPermissionGrid(user.permissions || {});
            openUserModal();
        }

        async function loadUsers() {
            if (!hasPermission('users.view')) return;
            await loadSecurityCatalog();
            try {
                const res = await apiFetch(`${API_URL}/users`);
                const data = await res.json();
                if (!res.ok) {
                    showAppToast(data.error || 'خطا در دریافت کاربران');
                    return;
                }
                allUsers = data;
                renderUsersTable();
            } catch (e) {
                console.error(e);
            }
        }

        function getRoleClass(role) {
            if (role === 'admin') return 'role-admin';
            if (role === 'technician') return 'role-technician';
            return 'role-sales';
        }

        function renderUsersTable() {
            const container = document.getElementById('usersGroupsContainer');
            if (!container) return;
            if (!allUsers.length) {
                container.innerHTML = '<div class="mini-empty-state">کاربری ثبت نشده است.</div>';
                return;
            }

            const groups = [
                { role: 'admin', title: 'ادمین' },
                { role: 'technician', title: 'تکنسین‌های فنی' },
                { role: 'sales', title: 'کارشناسان فروش' }
            ];

            container.innerHTML = groups.map(group => {
                const users = allUsers.filter(user => getUserRoles(user).includes(group.role));
                const rows = users.length ? users.map((user, index) => `
                    <tr>
                        <td>
                            <div class="user-order-cell">
                                <span class="user-order-number">${index + 1}</span>
                                ${hasPermission('users.priority') ? `
                                    <div class="priority-arrows">
                                        <button onclick="moveUser('${user.id}', 'up')" class="priority-arrow-btn" aria-label="انتقال به بالا">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"></path></svg>
                                        </button>
                                        <button onclick="moveUser('${user.id}', 'down')" class="priority-arrow-btn" aria-label="انتقال به پایین">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td title="${escapeAttr(user.full_name)}">${escapeHtml(user.full_name)}</td>
                        <td class="font-black ltr" title="${escapeAttr(user.username)}">${escapeHtml(user.username)}</td>
                        <td><span class="role-badge ${getRoleClass(getUserRoles(user)[0])}">${escapeHtml(user.role_names || user.role_name || getUserRoles(user).map(roleLabel).join('، '))}</span></td>
                        <td><span class="active-badge ${user.is_active ? 'active-yes' : 'active-no'}">${user.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                        <td>
                            <div class="row-actions">
                                ${hasPermission('users.update') ? `<button type="button" onclick="editUser('${user.id}')" class="inline-action-btn inline-action-blue">مدیریت</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('') : `<tr><td colspan="6">در این دسته کاربری ثبت نشده است.</td></tr>`;

                return `
                    <div class="user-role-group-card">
                        <div class="user-role-group-header">
                            <div class="user-role-title">
                                <span>${escapeHtml(group.title)}</span>
                                <span class="date-count">${users.length} کاربر</span>
                            </div>
                        </div>
                        <div class="users-table-wrap grouped-users-table">
                            <table class="users-table">
                                <colgroup>
                                    <col class="user-col-order">
                                    <col class="user-col-name">
                                    <col class="user-col-username">
                                    <col class="user-col-role">
                                    <col class="user-col-status">
                                    <col class="user-col-actions">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>ترتیب</th>
                                        <th>نام کامل</th>
                                        <th>نام کاربری</th>
                                        <th>نقش</th>
                                        <th>وضعیت</th>
                                        <th>عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function handleUserFormSubmit(event) {
            event.preventDefault();
            const form = document.getElementById('userForm');
            if (form && !form.checkValidity()) {
                showAppToast('لطفاً اطلاعات الزامی کاربر را کامل کنید.', 'error');
                return;
            }
            const isEdit = Boolean(editingUserId);
            if (isEdit && !requireClientPermission('users.update')) return;
            if (!isEdit && !requireClientPermission('users.create')) return;
            if (!hasPermission('users.permissions')) {
                showAppToast('برای تعیین دسترسی‌ها باید مجوز تعیین دسترسی داشته باشید.');
                return;
            }

            const payload = {
                username: document.getElementById('user_username').value.trim(),
                full_name: document.getElementById('user_full_name').value.trim(),
                roles: getSelectedRolesFromForm(),
                role: getSelectedRolesFromForm()[0] || 'sales',
                is_active: document.getElementById('user_is_active').checked,
                permissions: getPermissionsFromForm()
            };
            const userPasswordValue = document.getElementById('user_password').value;
            if (!isEdit || userPasswordValue) {
                payload.password = userPasswordValue;
            }

            const btn = document.getElementById('userSaveBtn');
            const original = btn.innerText;
            btn.innerText = 'در حال ذخیره...';
            btn.disabled = true;
            try {
                const res = await apiFetch(isEdit ? `${API_URL}/users/${editingUserId}` : `${API_URL}/users`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) {
                    showAppToast(data.error || 'خطا در ذخیره کاربر');
                    return;
                }
                closeUserModal();
                resetUserForm();
                await loadUsers();
                await loadMetadata();
                showCopyToast('کاربر ذخیره شد');
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = original;
                btn.disabled = false;
            }
        }

        function resetUserPassword(userId) {
            if (!requireClientPermission('users.reset_password')) return;
            const user = allUsers.find(item => String(item.id) === String(userId));
            document.getElementById('reset_user_id').value = userId;
            document.getElementById('resetPasswordUserName').innerText = user ? `کاربر: ${user.full_name}` : '';
            document.getElementById('reset_password_new').value = '';
            document.getElementById('reset_password_confirm').value = '';
            document.getElementById('resetPasswordModal').style.display = 'flex';
            setTimeout(() => document.getElementById('reset_password_new')?.focus(), 50);
        }

        function closeResetPasswordModal() {
            const modal = document.getElementById('resetPasswordModal');
            if (modal) modal.style.display = 'none';
        }

        async function submitResetUserPassword() {
            if (!requireClientPermission('users.reset_password')) return;
            const userId = document.getElementById('reset_user_id').value;
            const newPassword = document.getElementById('reset_password_new').value;
            const confirmPassword = document.getElementById('reset_password_confirm').value;
            if (!newPassword || newPassword.length < 4) {
                showAppToast('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showAppToast('رمز عبور و تکرار آن یکسان نیست.');
                return;
            }
            const res = await apiFetch(`${API_URL}/users/${userId}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            const data = await res.json();
            if (!res.ok) return showAppToast(data.error || 'خطا در ریست رمز');
            closeResetPasswordModal();
            showCopyToast('رمز عبور تغییر کرد');
        }

        function deleteEditingUserFromModal() {
            if (!editingUserId) return;
            const userIdToDelete = editingUserId;
            closeUserModal();
            deleteUser(userIdToDelete);
        }

        function deleteUser(userId) {
            if (!requireClientPermission('users.delete')) return;
            const user = allUsers.find(item => String(item.id) === String(userId));
            document.getElementById('delete_user_id').value = userId;
            document.getElementById('deleteUserConfirmText').innerHTML = `کاربر <b>${escapeHtml(user?.full_name || '')}</b> غیرفعال می‌شود و دیگر امکان ورود ندارد. ادامه می‌دهید؟`;
            document.getElementById('deleteUserConfirmModal').style.display = 'flex';
        }

        function closeDeleteUserConfirmModal() {
            const modal = document.getElementById('deleteUserConfirmModal');
            if (modal) modal.style.display = 'none';
        }

        async function confirmDeleteUser() {
            if (!requireClientPermission('users.delete')) return;
            const userId = String(document.getElementById('delete_user_id').value || '').trim();
            if (!/^\d+$/.test(userId)) {
                showAppToast('شناسه کاربر معتبر نیست. صفحه را بروزرسانی کنید.');
                closeDeleteUserConfirmModal();
                return;
            }
            const res = await apiFetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) return showAppToast(data.error || 'خطا در غیرفعال‌سازی کاربر');
            closeDeleteUserConfirmModal();
            await loadUsers();
            await loadMetadata();
            showCopyToast('کاربر غیرفعال شد');
        }

        async function moveUser(userId, direction) {
            if (!requireClientPermission('users.priority')) return;
            try {
                const res = await apiFetch(`${API_URL}/users/${userId}/move`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ direction })
                });
                const data = await res.json();
                if (!res.ok) return showAppToast(data.error || 'خطا در جابه‌جایی کاربر');
                await loadUsers();
                await loadMetadata();
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            }
        }


        function getLookupTypeConfig(type = lookupActiveType) {
            return LOOKUP_TYPES.find(item => item.type === type) || LOOKUP_TYPES[0];
        }

        function getLookupTabCount(type) {
            if (type === lookupActiveType) return lookupRows.length;
            if (Object.prototype.hasOwnProperty.call(lookupCounts, type)) return Number(lookupCounts[type] || 0);
            return '…';
        }

        function renderLookupTabs() {
            const container = document.getElementById('lookupTabsContainer');
            if (!container) return;
            container.innerHTML = LOOKUP_TYPES.map(item => `
                <button type="button" class="lookup-tab-btn ${lookupActiveType === item.type ? 'active-lookup-tab' : ''}" onclick="selectLookupType('${item.type}')">
                    <span>${escapeHtml(item.title)}</span>
                    <span class="filter-count">${escapeHtml(getLookupTabCount(item.type))}</span>
                </button>
            `).join('');
        }

        async function loadLookupTabCounts() {
            if (!hasPermission('lookups.view') || lookupCountsLoading) return;
            lookupCountsLoading = true;
            try {
                const entries = await Promise.all(LOOKUP_TYPES.map(async item => {
                    if (item.type === lookupActiveType) return [item.type, lookupRows.length];
                    try {
                        const res = await apiFetch(`${API_URL}/lookups/${item.type}?_=${Date.now()}`, { cache: 'no-store' });
                        const data = await res.json();
                        if (!res.ok || !Array.isArray(data.rows)) {
                            return [item.type, lookupCounts[item.type]];
                        }
                        return [item.type, data.rows.length];
                    } catch (e) {
                        return [item.type, lookupCounts[item.type]];
                    }
                }));
                entries.forEach(([type, count]) => {
                    if (typeof count !== 'undefined') lookupCounts[type] = Number(count || 0);
                });
                renderLookupTabs();
            } finally {
                lookupCountsLoading = false;
            }
        }

        function renderLookupEditor() {
            const config = getLookupTypeConfig();
            const container = document.getElementById('lookupEditorContainer');
            if (!container) return;
            const editingRow = lookupRows.find(item => String(item.id) === String(lookupEditingId));
            container.innerHTML = `
                <div class="advanced-search-title">
                    <div>
                        <strong>${lookupEditingId ? 'ویرایش' : 'افزودن'} ${escapeHtml(config.title)}</strong>
                        <span>تغییرات این بخش مستقیماً در فرم‌ها و لیست‌های پورتال استفاده می‌شود.</span>
                    </div>
                </div>
                <form id="lookupForm" onsubmit="handleLookupFormSubmit(event)">
                    <div class="lookup-editor-grid">
                        <div class="field">
                            <label>${escapeHtml(config.nameLabel)}</label>
                            <input id="lookup_name" type="text" required value="${escapeAttr(editingRow?.name || '')}" placeholder="نام را وارد کنید">
                        </div>
                        <button type="submit" class="primary-submit">${lookupEditingId ? 'ذخیره تغییرات' : 'افزودن'}</button>
                        <button type="button" onclick="cancelLookupEdit()" class="secondary-btn">${lookupEditingId ? 'انصراف' : 'پاکسازی'}</button>
                    </div>
                </form>
            `;
        }

        function renderLookups() {
            renderLookupTabs();
            renderLookupEditor();
            const container = document.getElementById('lookupsContainer');
            if (!container) return;
            const config = getLookupTypeConfig();
            if (!lookupRows.length) {
                container.innerHTML = `<div class="mini-empty-state">برای ${escapeHtml(config.title)} موردی ثبت نشده است.</div>`;
                return;
            }

            container.innerHTML = `
                <div class="advanced-search-title">
                    <div>
                        <strong>لیست ${escapeHtml(config.title)}</strong>
                        <span>موارد غیرفعال در ثبت فاکتور جدید نمایش داده نمی‌شوند، اما برای فاکتورهای قبلی قابل نگهداری هستند.</span>
                    </div>
                </div>
                <div class="lookup-table-wrap">
                    <table class="lookup-table">
                        <thead>
                            <tr>
                                <th style="width:90px;">ترتیب</th>
                                <th>نام</th>
                                <th style="width:110px;">وضعیت</th>
                                <th style="width:120px;">استفاده شده</th>
                                <th style="width:310px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lookupRows.map((row, index) => `
                                <tr>
                                    <td>
                                        <div class="user-order-cell">
                                            <span class="user-order-number">${index + 1}</span>
                                            ${hasPermission('lookups.priority') ? `
                                                <div class="priority-arrows">
                                                    <button type="button" onclick="moveLookupItem('${row.id}', 'up')" class="priority-arrow-btn" aria-label="انتقال به بالا">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"></path></svg>
                                                    </button>
                                                    <button type="button" onclick="moveLookupItem('${row.id}', 'down')" class="priority-arrow-btn" aria-label="انتقال به پایین">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </td>
                                    <td class="lookup-name-cell" title="${escapeAttr(row.name)}">${escapeHtml(row.name)}</td>
                                    <td><span class="active-badge ${row.is_active ? 'active-yes' : 'active-no'}">${row.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                                    <td>${Number(row.usage_count || 0)}</td>
                                    <td>
                                        <div class="row-actions">
                                            ${hasPermission('lookups.update') ? `<button type="button" onclick="editLookupItem('${row.id}')" class="inline-action-btn inline-action-blue">ویرایش</button>` : ''}
                                            ${hasPermission('lookups.update') ? `<button type="button" onclick="toggleLookupActive('${row.id}', ${row.is_active ? 'false' : 'true'})" class="inline-action-btn ${row.is_active ? 'inline-action-neutral' : 'inline-action-blue'}">${row.is_active ? 'غیرفعال' : 'فعال‌سازی'}</button>` : ''}
                                            ${hasPermission('lookups.delete') ? `<button type="button" onclick="deleteLookupItem('${row.id}')" class="inline-action-btn inline-action-red">حذف</button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        async function loadLookups(type = lookupActiveType) {
            if (!hasPermission('lookups.view')) return false;
            lookupActiveType = type;
            renderLookupTabs();
            const container = document.getElementById('lookupsContainer');
            if (container) container.innerHTML = '<div class="mini-empty-state">در حال دریافت اطلاعات پایه...</div>';
            try {
                const res = await apiFetch(`${API_URL}/lookups/${lookupActiveType}?_=${Date.now()}`, { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) {
                    showAppToast(data.error || 'خطا در دریافت اطلاعات پایه');
                    renderLookups();
                    return false;
                }
                lookupRows = Array.isArray(data.rows) ? data.rows : [];
                lookupCounts[lookupActiveType] = lookupRows.length;
                renderLookups();
                loadLookupTabCounts();
                return true;
            } catch (e) {
                console.error(e);
                renderLookups();
                showAppToast('خطا در ارتباط با سرور');
                return false;
            }
        }

        async function refreshLookupsAfterChange(type = lookupActiveType) {
            const refreshed = await loadLookups(type);
            if (!refreshed) renderLookups();
            await loadMetadata();
        }

        function selectLookupType(type) {
            lookupEditingId = '';
            loadLookups(type);
        }

        function editLookupItem(id) {
            if (!requireClientPermission('lookups.update')) return;
            lookupEditingId = String(id);
            renderLookupEditor();
            setTimeout(() => document.getElementById('lookup_name')?.focus(), 50);
        }

        function cancelLookupEdit() {
            lookupEditingId = '';
            const input = document.getElementById('lookup_name');
            if (input) input.value = '';
            renderLookupEditor();
        }

        async function handleLookupFormSubmit(event) {
            event.preventDefault();
            const name = document.getElementById('lookup_name')?.value.trim() || '';
            if (!name) return showAppToast('نام نمی‌تواند خالی باشد.');
            const isEdit = Boolean(lookupEditingId);
            if (isEdit && !requireClientPermission('lookups.update')) return;
            if (!isEdit && !requireClientPermission('lookups.create')) return;

            try {
                const res = await apiFetch(isEdit ? `${API_URL}/lookups/${lookupActiveType}/${lookupEditingId}` : `${API_URL}/lookups/${lookupActiveType}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const data = await res.json();
                if (!res.ok) return showAppToast(data.error || 'خطا در ذخیره اطلاعات پایه');
                const savedRow = data && data.id ? data : (data && data.row ? data.row : null);
                if (savedRow && savedRow.id) {
                    const rowWithUsage = { usage_count: 0, ...savedRow };
                    const existingIndex = lookupRows.findIndex(item => String(item.id) === String(savedRow.id));
                    if (existingIndex >= 0) lookupRows[existingIndex] = { ...lookupRows[existingIndex], ...rowWithUsage };
                    else lookupRows.push(rowWithUsage);
                    lookupRows.sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || Number(a.id || 0) - Number(b.id || 0));
                    lookupCounts[lookupActiveType] = lookupRows.length;
                    renderLookups();
                }
                lookupEditingId = '';
                await refreshLookupsAfterChange(lookupActiveType);
                showCopyToast(isEdit ? 'مورد ویرایش شد' : 'مورد اضافه شد');
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            }
        }

        async function toggleLookupActive(id, isActive) {
            if (!requireClientPermission('lookups.update')) return;
            const row = lookupRows.find(item => String(item.id) === String(id));
            if (!row) return;
            try {
                const res = await apiFetch(`${API_URL}/lookups/${lookupActiveType}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: row.name, is_active: Boolean(isActive) })
                });
                const data = await res.json();
                if (!res.ok) return showAppToast(data.error || 'خطا در تغییر وضعیت');
                await refreshLookupsAfterChange(lookupActiveType);
                showCopyToast(Boolean(isActive) ? 'مورد فعال شد' : 'مورد غیرفعال شد');
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            }
        }

        async function deleteLookupItem(id) {
            if (!requireClientPermission('lookups.delete')) return;
            const row = lookupRows.find(item => String(item.id) === String(id));
            if (!row) return;
            const message = Number(row.usage_count || 0) > 0
                ? `این مورد در ${row.usage_count} فاکتور استفاده شده و به‌جای حذف، غیرفعال می‌شود. ادامه می‌دهید؟`
                : `مورد «${row.name}» حذف شود؟`;
            if (!confirm(message)) return;
            try {
                const res = await apiFetch(`${API_URL}/lookups/${lookupActiveType}/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) return showAppToast(data.error || 'خطا در حذف اطلاعات پایه');
                await refreshLookupsAfterChange(lookupActiveType);
                showCopyToast(data.deactivated ? 'مورد غیرفعال شد' : 'مورد حذف شد');
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            }
        }

        async function moveLookupItem(id, direction) {
            if (!requireClientPermission('lookups.priority')) return;
            try {
                const res = await apiFetch(`${API_URL}/lookups/${lookupActiveType}/${id}/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ direction })
                });
                const data = await res.json();
                if (!res.ok) return showAppToast(data.error || 'خطا در جابه‌جایی');
                await refreshLookupsAfterChange(lookupActiveType);
            } catch (e) {
                console.error(e);
                showAppToast('خطا در ارتباط با سرور');
            }
        }


        const STATUS_OPTIONS = [
            { value: 'Pending', label: 'در انتظار انجام', badgeClass: 'badge-pending' },
            { value: 'Waiting-Goods', label: 'در انتظار دریافت کالا', badgeClass: 'badge-waiting' },
            { value: 'In-Progress', label: 'در حال انجام', badgeClass: 'badge-progress' },
            { value: 'Cancelled', label: 'کنسل شده', badgeClass: 'badge-danger' },
            { value: 'Returned', label: 'برگشت خورده', badgeClass: 'badge-danger' },
            { value: 'Completed', label: 'تکمیل شده', badgeClass: 'badge-completed' }
        ];

        let TECHNICIANS = [];

        let currentSerials = [];
        let relInvoices = [];
        let editRelInvoices = [];
        let opsRelInvoices = [];
        let serialEditingIndex = -1;
        let techNotes = [];
        let editingTechNoteIndex = -1;
        let sellerInitialDescription = '';
        let sellerNotes = [];
        let editingSellerNoteIndex = -1;
        let technicianAssignments = {};
        let pendingDeleteOrderId = '';
        let pendingOrderEdit = null;
        let currentOpsOrder = null;
        let allOrdersData = [];
        let currentServerDatePart = '';
        let activeStatusFilter = 'All';
        let searchQuery = '';
        let warrantyLookup = {};
        let metadataStore = { sellers: [], models: [], cities: [], warehouses: [], warranties: [], config_types: [] };
        const LOOKUP_TYPES = [
            { type: 'device_models', title: 'مدل سرورها', nameLabel: 'نام مدل سرور' },
            { type: 'cities', title: 'شهرها', nameLabel: 'نام شهر' },
            { type: 'warehouses', title: 'انبارها', nameLabel: 'نام انبار' },
            { type: 'warranties', title: 'گارانتی‌ها', nameLabel: 'نام گارانتی' },
            { type: 'config_types', title: 'نوع کانفیگ‌ها', nameLabel: 'نام نوع کانفیگ' }
        ];
        let lookupActiveType = 'device_models';
        let lookupRows = [];
        let lookupCounts = {};
        let lookupCountsLoading = false;
        let lookupEditingId = '';
        let archiveSearchApplied = false;
        let activityLogUsersLoaded = false;
        let reportDateInitialized = false;
        let reportDrillPath = [];
        let reportCurrentSlices = [];

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function escapeAttr(value) {
            return escapeHtml(value);
        }

        function normalizeText(value) {
            return String(value ?? '').toLowerCase().trim();
        }


        function escapeRegExp(value) {
            return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function highlightSearchText(value) {
            const raw = String(value ?? '-');
            const q = String(searchQuery || '').trim();
            if (!q) return escapeHtml(raw);
            try {
                const pattern = new RegExp(`(${escapeRegExp(q)})`, 'gi');
                return escapeHtml(raw).replace(pattern, '<mark class="search-hit">$1</mark>');
            } catch (e) {
                return escapeHtml(raw);
            }
        }

        function splitCommaList(value) {
            return String(value ?? '')
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }

        function parseJsonArray(value) {
            if (Array.isArray(value)) return value;
            if (!value) return [];
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) { return []; }
            }
            return [];
        }

        function parseJsonObject(value) {
            if (value && typeof value === 'object' && !Array.isArray(value)) return value;
            if (!value) return {};
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (e) { return {}; }
            }
            return {};
        }

        function getStatusConfig(status) {
            return STATUS_OPTIONS.find(item => item.value === status) || STATUS_OPTIONS[0];
        }

        function getStatusLabel(status) {
            return getStatusConfig(status).label;
        }

        function getStatusBadgeClass(status) {
            return getStatusConfig(status).badgeClass;
        }

        function showAppToast(message = 'عملیات انجام شد.', type = 'info', duration = 2600) {
            const toast = document.getElementById('copyToast');
            if (!toast) return;
            toast.innerText = String(message || 'عملیات انجام شد.');
            toast.className = `font-bold app-toast app-toast-${type || 'info'}`;
            toast.style.display = 'block';
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
        }

        function showCopyToast(message = 'در حافظه کپی شد') {
            showAppToast(message, 'success', 1200);
        }

        function copyToClipboard(text, message = 'در حافظه کپی شد') {
            if (!text || text === '-') return;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => { showCopyToast(message); }).catch(err => { fallbackCopy(text, message); });
            } else { fallbackCopy(text, message); }
        }

        function fallbackCopy(text, message = 'در حافظه کپی شد') {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try { document.execCommand('copy'); showCopyToast(message); } catch (err) {}
            document.body.removeChild(textArea);
        }

        function renderSerials() {
            const list = document.getElementById('serials_list');
            list.innerHTML = '';

            if (currentSerials.length === 0) {
                list.innerHTML = `<div class="mini-empty-state" style="direction: rtl;">هنوز سریالی ثبت نشده است.</div>`;
                return;
            }

            currentSerials.forEach((s, index) => {
                const isEditing = serialEditingIndex === index;
                list.innerHTML += `
                    <div class="serial-row">
                        <div class="flex items-center gap-3 flex-1 overflow-hidden">
                            <span class="text-xs font-black text-slate-400">${index + 1}.</span>
                            ${isEditing ? 
                                `<input id="edit_input_${index}" class="serial-input-edit" value="${escapeAttr(s)}" onblur="saveInlineEdit(${index})" onkeydown="if(event.key === 'Enter') saveInlineEdit(${index})">` : 
                                `<span class="font-black text-slate-700 truncate block">${escapeHtml(s)}</span>`
                            }
                        </div>
                        <div class="serial-actions">
                            <button onclick="copySerialAndLog('${escapeAttr(s)}')" class="text-slate-500 hover:text-blue-600 text-[11px] font-black">کپی</button>
                            ${hasPermission('orders.serials') ? `<button onclick="removeSerial(${index})" class="text-red-500 hover:text-red-700 font-black px-2 text-xs">حذف</button>` : ''}
                            ${hasPermission('orders.serials') && !isEditing ? `<button onclick="startInlineEdit(${index})" class="text-blue-500 text-[11px] font-black">ویرایش</button>` : ''}
                        </div>
                    </div>
                `;
                if(isEditing) setTimeout(() => document.getElementById(`edit_input_${index}`).focus(), 50);
            });
        }


        async function copySerialAndLog(serial) {
            copyToClipboard(serial, 'سریال در حافظه کپی شد');
            const orderId = document.getElementById('serial_order_id')?.value || document.getElementById('edit_order_id')?.value || '';
            if (!orderId || !authToken) return;
            try {
                await apiFetch(`${API_URL}/orders/${orderId}/serial-copy-log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serial })
                });
            } catch (e) {
                console.error(e);
            }
        }

        function startInlineEdit(index) {
            serialEditingIndex = index;
            renderSerials();
        }

        function saveInlineEdit(index) {
            const input = document.getElementById(`edit_input_${index}`);
            if (input) {
                const value = input.value.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
                if (value && currentSerials.some((item, i) => item === value && i !== index)) {
                    showAppToast('این سریال قبلاً در لیست ثبت شده است.');
                    serialEditingIndex = -1;
                    renderSerials();
                    return;
                }
                if (value) currentSerials[index] = value;
            }
            serialEditingIndex = -1;
            renderSerials();
        }

        function addSerial() {
            if (!requireClientPermission('orders.serials')) return;
            const input = document.getElementById('serial_input');
            const newSerial = input.value.trim().toUpperCase(); 
            if (newSerial) {
                if (currentSerials.includes(newSerial)) {
                    showAppToast('این سریال قبلاً در لیست ثبت شده است.');
                    return;
                }
                currentSerials.push(newSerial);
                input.value = '';
                renderSerials();
            }
        }

        function removeSerial(index) {
            currentSerials.splice(index, 1);
            renderSerials();
        }

        function openSerialModalById(orderId) {
            if (!requireClientPermission('orders.view', 'شما دسترسی مشاهده فاکتورها را ندارید.')) return;
            const order = allOrdersData.find(o => String(o.id) === String(orderId));
            if (!order) return;
            document.getElementById('serial_order_id').value = order.id;
            document.getElementById('serialModalTitle').innerText = `سریال های فاکتور ${order.invoice_number || '-'}`;
            currentSerials = splitCommaList(order.serials).map(s => s.toUpperCase());
            serialEditingIndex = -1;
            renderSerials();
            applySerialPermissions();
            document.getElementById('serialModal').style.display = 'flex';
        }


        function applySerialPermissions() {
            const canSerials = hasPermission('orders.serials');
            const input = document.getElementById('serial_input');
            const saveBtn = document.getElementById('serialSaveBtn');
            const addBtn = document.querySelector('#serialModal .inline-form-row .soft-primary-btn');
            if (input) input.disabled = !canSerials;
            if (addBtn) addBtn.style.display = canSerials ? '' : 'none';
            if (saveBtn) saveBtn.style.display = canSerials ? '' : 'none';
        }

        function closeSerialModal() {
            document.getElementById('serialModal').style.display = 'none';
        }

        async function submitSerialsUpdate() {
            if (!requireClientPermission('orders.serials')) return;
            const id = document.getElementById('serial_order_id').value;
            if (!id) return;

            const btn = document.getElementById('serialSaveBtn');
            const originalText = btn.innerText;
            btn.innerText = 'در حال ذخیره...';
            btn.disabled = true;

            try {
                const res = await apiFetch(`${API_URL}/orders/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serials: currentSerials.join(', ') })
                });

                if (res.ok) {
                    closeSerialModal();
                    loadOrders();
                } else {
                    const data = await res.json();
                    showAppToast(data.error || 'خطا در ذخیره سریال‌ها');
                }
            } catch (error) {
                console.error(error);
                showAppToast('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

        function addRelInvoice() {
            const input = document.getElementById('rel_invoice_input');
            const val = input.value.trim();
            if (val && !relInvoices.includes(val)) {
                relInvoices.push(val);
                input.value = '';
                renderRelInvoices();
            }
        }

        function renderRelInvoices() {
            const list = document.getElementById('rel_invoices_list');
            list.innerHTML = relInvoices.map((inv, index) => `
                <span class="rel-chip">
                    ${escapeHtml(inv)}
                    <button type="button" onclick="relInvoices.splice(${index}, 1); renderRelInvoices()" class="text-red-500 font-black">×</button>
                </span>
            `).join('');
        }

        function addEditRelInvoice() {
            const input = document.getElementById('edit_rel_invoice_input');
            const val = input.value.trim();
            if (val && !editRelInvoices.includes(val)) {
                editRelInvoices.push(val);
                input.value = '';
                renderEditRelInvoices();
            }
        }

        function renderEditRelInvoices() {
            const list = document.getElementById('edit_rel_invoices_list');
            list.innerHTML = editRelInvoices.map((inv, index) => `
                <span class="rel-chip">
                    ${escapeHtml(inv)}
                    <button type="button" onclick="editRelInvoices.splice(${index}, 1); renderEditRelInvoices()" class="text-red-500 font-black">×</button>
                </span>
            `).join('');
        }

        function addOpsRelInvoice() {
            if (!requireClientPermission('orders.related')) return;
            const input = document.getElementById('ops_rel_invoice_input');
            const val = input.value.trim();
            if (val && !opsRelInvoices.includes(val)) {
                opsRelInvoices.push(val);
                input.value = '';
                renderOpsRelInvoices();
            }
        }

        function renderOpsRelInvoices() {
            const list = document.getElementById('ops_rel_invoices_list');
            if (opsRelInvoices.length === 0) {
                list.innerHTML = '';
                return;
            }

            list.innerHTML = opsRelInvoices.map((inv, index) => `
                <div class="ops-related-row">
                    <span class="ops-related-invoice">${escapeHtml(inv)}</span>
                    ${hasPermission('orders.related') ? `<button type="button" onclick="opsRelInvoices.splice(${index}, 1); renderOpsRelInvoices()" class="inline-action-btn inline-action-red">حذف</button>` : ''}
                </div>
            `).join('');
        }

        function toggleWarehouseLogic() {
            const wh = document.getElementById('warehouse_id');
            const pNum = document.getElementById('purchase_number');
            const war = document.getElementById('warranty');
            const isInternal = wh.options[wh.selectedIndex] && wh.options[wh.selectedIndex].text === 'داخلی';

            pNum.disabled = !isInternal;
            war.disabled = !isInternal;
            pNum.required = isInternal;
            war.required = isInternal;

            pNum.classList.toggle('locked-field', !isInternal);
            war.classList.toggle('locked-field', !isInternal);
            
            if(!isInternal) {
                pNum.value = '';
                war.value = '';
            }
        }

        function toggleEditWarehouseLogic() {
            const wh = document.getElementById('edit_warehouse_id');
            const pNum = document.getElementById('edit_purchase_number');
            const war = document.getElementById('edit_warranty');
            const isInternal = wh.options[wh.selectedIndex] && wh.options[wh.selectedIndex].text === 'داخلی';

            pNum.disabled = !isInternal;
            war.disabled = !isInternal;
            pNum.required = isInternal;
            war.required = isInternal;

            pNum.classList.toggle('locked-field', !isInternal);
            war.classList.toggle('locked-field', !isInternal);
            
            if(!isInternal) {
                pNum.value = '';
                war.value = '';
            }
        }

        function openOpsModalById(orderId) {
            const order = allOrdersData.find(o => String(o.id) === String(orderId));
            if (order) openOpsModal(order);
        }

        function renderOpsSummary(order) {
            const title = document.getElementById('opsModalTitle');
            if (title) title.innerText = `مدیریت فاکتور ${order.invoice_number || '-'}`;
            const summary = document.getElementById('opsInvoiceSummary');
            if (summary) summary.innerHTML = '';
        }

        function openOpsModal(order) {
            currentOpsOrder = order;
            pendingOrderEdit = null;
            document.getElementById('edit_order_id').value = order.id;
            document.getElementById('edit_status').value = order.status || 'Pending';

            const parsedNotes = parseJsonArray(order.technical_notes);
            techNotes = parsedNotes.length
                ? parsedNotes.map((note, index) => ({
                    id: note.id || `${Date.now()}-${index}`,
                    text: String(note.text ?? '').trim(),
                    created_at: note.created_at || ''
                })).filter(note => note.text)
                : (order.technical_description ? [{ id: `old-${order.id}`, text: order.technical_description, created_at: '' }] : []);

            editingTechNoteIndex = -1;
            sellerInitialDescription = String(order.seller_description || '').trim();
            sellerNotes = parseJsonArray(order.seller_notes).map((note, index) => ({
                id: note.id || `${Date.now()}-seller-${index}`,
                text: String(note.text ?? '').trim(),
                created_at: note.created_at || ''
            })).filter(note => note.text);
            editingSellerNoteIndex = -1;
            opsRelInvoices = splitCommaList(order.related_invoices);
            technicianAssignments = parseJsonObject(order.technician_assignments);
            TECHNICIANS.forEach(name => {
                if (typeof technicianAssignments[name] !== 'boolean') technicianAssignments[name] = false;
            });

            renderOpsSummary(order);
            renderTechNotes();
            renderSellerNotes();
            renderOpsRelInvoices();
            renderTechnicians();
            applyOpsPermissions();
            document.getElementById('opsModal').style.display = 'flex';
            openInvoiceMedia(order.id);
        }

        function applyOpsPermissions() {
            const setDisabled = (id, disabled) => {
                const el = document.getElementById(id);
                if (el) el.disabled = disabled;
            };
            const canTechnical = hasPermission('orders.technical');
            const canSalesNotes = hasPermission('orders.sales_notes');
            const canRelated = hasPermission('orders.related');
            const canSerials = hasPermission('orders.serials');
            const canEdit = hasPermission('orders.update');
            const canDelete = hasPermission('orders.delete');

            setDisabled('edit_status', !canTechnical);
            setDisabled('tech_note_input', !canTechnical);
            setDisabled('seller_note_input', !canSalesNotes);
            setDisabled('ops_rel_invoice_input', !canRelated);

            const serialBtn = document.querySelector('.serial-manage-btn');
            if (serialBtn) serialBtn.style.display = '';
            if (serialBtn) serialBtn.disabled = false;
            const editBtn = document.querySelector('.ops-modal-footer button[onclick="openEditOrderModal()"]');
            if (editBtn) editBtn.style.display = canEdit ? '' : 'none';
            const deleteBtn = document.querySelector('.ops-modal-footer button[onclick="deleteCurrentOrder()"]');
            if (deleteBtn) deleteBtn.style.display = canDelete ? '' : 'none';
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) saveBtn.style.display = (canTechnical || canSalesNotes || canRelated || canEdit) ? '' : 'none';
        }

        function handleStatusChange() {
            renderTechnicians();
        }

        function addTechNote() {
            if (!requireClientPermission('orders.technical')) return;
            const input = document.getElementById('tech_note_input');
            const value = input.value.trim();
            if (!value) return;

            techNotes.push({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                text: value,
                created_at: new Date().toISOString()
            });
            input.value = '';
            renderTechNotes();
        }

        function renderTechNotes() {
            const list = document.getElementById('tech_notes_list');
            if (techNotes.length === 0) {
                list.innerHTML = '';
                return;
            }

            list.innerHTML = techNotes.map((note, index) => {
                const isEditing = editingTechNoteIndex === index;
                if (isEditing) {
                    return `
                        <div class="tech-note-row">
                            <input id="tech_note_edit_${index}" class="inline-edit-input" value="${escapeAttr(note.text)}" onkeydown="if(event.key === 'Enter') { event.preventDefault(); saveTechNoteEdit(${index}); }">
                            <div class="tech-note-actions">
                                <button type="button" onclick="saveTechNoteEdit(${index})" class="inline-action-btn inline-action-blue">ثبت</button>
                                <button type="button" onclick="cancelTechNoteEdit()" class="inline-action-btn inline-action-gray">لغو</button>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="tech-note-row">
                        <div class="tech-note-text">${escapeHtml(note.text)}</div>
                        ${hasPermission('orders.technical') ? `<div class="tech-note-actions">
                            <button type="button" onclick="startTechNoteEdit(${index})" class="inline-action-btn inline-action-blue">ویرایش</button>
                            <button type="button" onclick="removeTechNote(${index})" class="inline-action-btn inline-action-red">حذف</button>
                        </div>` : ''}
                    </div>
                `;
            }).join('');

            if (editingTechNoteIndex >= 0) {
                setTimeout(() => {
                    const input = document.getElementById(`tech_note_edit_${editingTechNoteIndex}`);
                    if (input) input.focus();
                }, 40);
            }
        }

        function startTechNoteEdit(index) {
            editingTechNoteIndex = index;
            renderTechNotes();
        }

        function saveTechNoteEdit(index) {
            const input = document.getElementById(`tech_note_edit_${index}`);
            if (!input) return;
            const value = input.value.trim();
            if (!value) {
                showAppToast('متن توضیح نمی‌تواند خالی باشد.');
                return;
            }
            techNotes[index].text = value;
            editingTechNoteIndex = -1;
            renderTechNotes();
        }

        function cancelTechNoteEdit() {
            editingTechNoteIndex = -1;
            renderTechNotes();
        }

        function removeTechNote(index) {
            techNotes.splice(index, 1);
            renderTechNotes();
        }


        function addSellerNote() {
            if (!requireClientPermission('orders.sales_notes')) return;
            const input = document.getElementById('seller_note_input');
            const value = input.value.trim();
            if (!value) return;

            sellerNotes.push({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                text: value,
                created_at: new Date().toISOString()
            });
            input.value = '';
            renderSellerNotes();
        }

        function renderSellerNotes() {
            const list = document.getElementById('seller_notes_list');
            if (!list) return;

            const initialHtml = sellerInitialDescription ? `
                <div class="tech-note-row seller-initial-note">
                    <div class="tech-note-text">${escapeHtml(sellerInitialDescription)}</div>
                    <span class="note-tag">توضیح اولیه</span>
                </div>
            ` : '';

            const extraHtml = sellerNotes.map((note, index) => {
                const isEditing = editingSellerNoteIndex === index;
                if (isEditing) {
                    return `
                        <div class="tech-note-row">
                            <input id="seller_note_edit_${index}" class="inline-edit-input" value="${escapeAttr(note.text)}" onkeydown="if(event.key === 'Enter') { event.preventDefault(); saveSellerNoteEdit(${index}); }">
                            <div class="tech-note-actions">
                                <button type="button" onclick="saveSellerNoteEdit(${index})" class="inline-action-btn inline-action-blue">ثبت</button>
                                <button type="button" onclick="cancelSellerNoteEdit()" class="inline-action-btn inline-action-gray">لغو</button>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="tech-note-row">
                        <div class="tech-note-text">${escapeHtml(note.text)}</div>
                        ${hasPermission('orders.sales_notes') ? `<div class="tech-note-actions">
                            <button type="button" onclick="startSellerNoteEdit(${index})" class="inline-action-btn inline-action-blue">ویرایش</button>
                            <button type="button" onclick="removeSellerNote(${index})" class="inline-action-btn inline-action-red">حذف</button>
                        </div>` : ''}
                    </div>
                `;
            }).join('');

            list.innerHTML = initialHtml || extraHtml ? `${initialHtml}${extraHtml}` : '';

            if (editingSellerNoteIndex >= 0) {
                setTimeout(() => {
                    const input = document.getElementById(`seller_note_edit_${editingSellerNoteIndex}`);
                    if (input) input.focus();
                }, 40);
            }
        }

        function startSellerNoteEdit(index) {
            editingSellerNoteIndex = index;
            renderSellerNotes();
        }

        function saveSellerNoteEdit(index) {
            const input = document.getElementById(`seller_note_edit_${index}`);
            if (!input) return;
            const value = input.value.trim();
            if (!value) {
                showAppToast('متن توضیح نمی‌تواند خالی باشد.');
                return;
            }
            sellerNotes[index].text = value;
            editingSellerNoteIndex = -1;
            renderSellerNotes();
        }

        function cancelSellerNoteEdit() {
            editingSellerNoteIndex = -1;
            renderSellerNotes();
        }

        function removeSellerNote(index) {
            sellerNotes.splice(index, 1);
            renderSellerNotes();
        }

        function renderTechnicians() {
            const list = document.getElementById('technicians_list');
            const status = document.getElementById('edit_status').value;
            const isEditable = status === 'In-Progress' && hasPermission('orders.technical');

            list.innerHTML = TECHNICIANS.map(name => {
                const isOn = Boolean(technicianAssignments[name]);
                return `
                    <div class="technician-row ${isOn ? 'is-on' : 'is-off'} ${isEditable ? '' : 'is-locked'}">
                        <span class="technician-name">${escapeHtml(name)}</span>
                        <label class="toggle-control" title="${escapeAttr(name)}">
                            <input type="checkbox" ${isOn ? 'checked' : ''} ${isEditable ? '' : 'disabled'} onchange="setTechnicianState('${escapeAttr(name)}', this.checked)">
                            <span class="toggle-switch"></span>
                        </label>
                    </div>
                `;
            }).join('');
        }

        function setTechnicianState(name, checked) {
            if (!hasPermission('orders.technical')) { renderTechnicians(); return; }
            const status = document.getElementById('edit_status').value;
            if (status !== 'In-Progress') {
                renderTechnicians();
                return;
            }
            technicianAssignments[name] = checked;
        }

        async function submitOpsUpdate() {
            const id = document.getElementById('edit_order_id').value;
            if (!id) return;

            const payload = {};
            if (hasPermission('orders.technical')) {
                payload.status = document.getElementById('edit_status').value;
                payload.technical_notes = techNotes;
                payload.technical_description = techNotes.map(note => note.text).join('\n');
                payload.technician_assignments = technicianAssignments;
            }
            if (hasPermission('orders.sales_notes')) payload.seller_notes = sellerNotes;
            if (hasPermission('orders.related')) payload.related_invoices = opsRelInvoices.join(', ');
            if (Object.keys(payload).length === 0 && !pendingOrderEdit) {
                showAppToast('شما دسترسی ذخیره هیچ بخشی از این فرم را ندارید.');
                return;
            }

            const btn = document.getElementById('saveBtn');
            const originalText = btn.innerText;
            btn.innerText = 'در حال ذخیره...';
            btn.disabled = true;

            try {
                if (pendingOrderEdit && hasPermission('orders.update')) {
                    const editRes = await apiFetch(`${API_URL}/orders/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...pendingOrderEdit,
                            related_invoices: hasPermission('orders.related') ? opsRelInvoices.join(', ') : pendingOrderEdit.related_invoices
                        })
                    });

                    if (!editRes.ok) {
                        const editPayload = await editRes.json();
                        showAppToast(editPayload.error || 'خطا در ذخیره ویرایش فاکتور');
                        return;
                    }
                }

                if (Object.keys(payload).length > 0) {
                    const res = await apiFetch(`${API_URL}/orders/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        const data = await res.json();
                        showAppToast(data.error || 'خطا در ذخیره تغییرات');
                        return;
                    }
                }

                pendingOrderEdit = null;
                closeOpsModal();
                loadOrders();
            } catch (error) {
                console.error(error);
                showAppToast('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

        function openSerialModalFromOps() {
            const id = document.getElementById('edit_order_id').value;
            if (id) openSerialModalById(id);
        }

        function closeOpsModal() {
            clearInvoiceMedia();
            document.getElementById('opsModal').style.display = 'none';
            clearModalInputs('opsModal');
            techNotes = [];
            sellerNotes = [];
            sellerInitialDescription = '';
            pendingOrderEdit = null;
            currentOpsOrder = null;
        }

        function openEditOrderModal() {
            if (!requireClientPermission('orders.update')) return;
            const id = document.getElementById('edit_order_id').value;
            const order = allOrdersData.find(o => String(o.id) === String(id));
            if (!order) return;

            const source = pendingOrderEdit || order;
            document.getElementById('edit_invoice_number').value = source.invoice_number || '';
            document.getElementById('edit_buyer_name').value = source.buyer_name || '';
            document.getElementById('edit_device_model').value = source.device_model || '';
            document.getElementById('edit_city_id').value = source.city_id || '';
            document.getElementById('edit_warehouse_id').value = source.warehouse_id || '';
            document.getElementById('edit_config_type').value = source.config_type || 'Base';
            document.getElementById('edit_seller_id').value = source.seller_id || '';
            document.getElementById('edit_quantity').value = source.quantity || '';
            document.getElementById('edit_purchase_number').value = String(source.purchase_number || '').replace(/^K/i, '');
            document.getElementById('edit_warranty').value = source.warranty || '';

            toggleEditWarehouseLogic();

            document.getElementById('editOrderModal').style.display = 'flex';
        }

        function closeEditOrderModal() {
            document.getElementById('editOrderModal').style.display = 'none';
            clearModalInputs('editOrderModal');
        }

        async function handleEditOrderSubmit() {
            if (!requireClientPermission('orders.update')) return;
            const form = document.getElementById('editOrderForm');
            if (!form.checkValidity()) {
                showAppToast('لطفاً همه فیلدهای الزامی را کامل کنید.', 'error');
                return;
            }

            const id = document.getElementById('edit_order_id').value;
            if (!id) return;
            const order = allOrdersData.find(o => String(o.id) === String(id)) || {};

            pendingOrderEdit = {
                invoice_number: document.getElementById('edit_invoice_number').value,
                buyer_name: document.getElementById('edit_buyer_name').value,
                device_model: parseInt(document.getElementById('edit_device_model').value),
                city_id: parseInt(document.getElementById('edit_city_id').value),
                warehouse_id: parseInt(document.getElementById('edit_warehouse_id').value),
                config_type: document.getElementById('edit_config_type').value,
                seller_id: parseInt(document.getElementById('edit_seller_id').value),
                quantity: parseInt(document.getElementById('edit_quantity').value),
                seller_description: order.seller_description || '',
                purchase_number: document.getElementById('edit_purchase_number').value,
                warranty: document.getElementById('edit_warranty').value,
                related_invoices: opsRelInvoices.join(', ')
            };

            const title = document.getElementById('opsModalTitle');
            if (title) title.innerText = `مدیریت فاکتور ${pendingOrderEdit.invoice_number || '-'}`;
            closeEditOrderModal();
            showCopyToast('ویرایش فاکتور آماده ذخیره شد');
        }

        function deleteCurrentOrder() {
            if (!requireClientPermission('orders.delete')) return;
            const id = document.getElementById('edit_order_id').value;
            const order = allOrdersData.find(o => String(o.id) === String(id));
            if (!id || !order) return;

            pendingDeleteOrderId = id;
            document.getElementById('deleteConfirmText').innerText = `آیا از حذف فاکتور ${order.invoice_number || ''} مطمئن هستید؟`;
            document.getElementById('deleteConfirmModal').style.display = 'flex';
        }

        function closeDeleteConfirmModal() {
            pendingDeleteOrderId = '';
            document.getElementById('deleteConfirmModal').style.display = 'none';
        }

        async function confirmDeleteCurrentOrder() {
            if (!requireClientPermission('orders.delete')) return;
            const id = pendingDeleteOrderId;
            if (!id) return;

            const btn = document.getElementById('confirmDeleteBtn');
            const originalText = btn.innerText;
            btn.innerText = 'در حال حذف...';
            btn.disabled = true;

            try {
                const res = await apiFetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    closeDeleteConfirmModal();
                    closeOpsModal();
                    loadOrders();
                } else {
                    const data = await res.json();
                    showAppToast(data.error || 'خطا در حذف فاکتور');
                }
            } catch (error) {
                console.error(error);
                showAppToast('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

        function formatWarrantyValue(value) {
            const raw = String(value ?? '').trim();
            if (!raw) return '-';
            if (warrantyLookup[raw]) return warrantyLookup[raw];
            if (/ماه/.test(raw)) return raw;
            if (/^\d+$/.test(raw)) return `${raw} ماه`;
            return raw;
        }

        function formatPurchaseNumber(value) {
            const raw = String(value ?? '').trim();
            if (!raw) return '-';
            return `K${raw.replace(/^K/i, '')}`;
        }

        function showInfoModal(title, content, options = {}) {
            document.getElementById('infoModalTitle').innerText = title;
            const subtitleEl = document.getElementById('infoModalSubtitle');
            const subtitleText = Object.prototype.hasOwnProperty.call(options, 'subtitle') ? options.subtitle : 'اطلاعات تکمیلی فاکتور';
            subtitleEl.innerText = subtitleText;
            subtitleEl.style.display = subtitleText ? 'block' : 'none';
            document.getElementById('infoModalIcon').innerText = options.icon || 'i';

            const body = document.getElementById('infoModalBody');
            if (options.html) {
                body.innerHTML = content || `<div class="info-text-card">موردی ثبت نشده است.</div>`;
            } else {
                body.innerHTML = `<div class="info-text-card">${escapeHtml(content || 'موردی ثبت نشده است.')}</div>`;
            }

            document.getElementById('infoModal').style.display = 'flex';
        }

        function showSellerDescription(orderId) {
            const order = allOrdersData.find(o => String(o.id) === String(orderId));
            if (!order) return;

            const blocks = [];
            const initial = String(order.seller_description || '').trim();
            if (initial) {
                blocks.push(`<div class="tech-note-row seller-initial-note"><div class="tech-note-text">${escapeHtml(initial)}</div><span class="note-tag">توضیح اولیه</span></div>`);
            }

            parseJsonArray(order.seller_notes).forEach(note => {
                const text = String(note && note.text ? note.text : '').trim();
                if (text) blocks.push(`<div class="tech-note-row"><div class="tech-note-text">${escapeHtml(text)}</div></div>`);
            });

            showInfoModal(
                'توضیحات فروشنده',
                blocks.length ? `<div class="tech-notes-list">${blocks.join('')}</div>` : `<div class="seller-description-box">موردی ثبت نشده است.</div>`,
                {
                    html: true,
                    icon: '✎',
                    subtitle: ''
                }
            );
        }
        
        function showExtraInfo(orderId) {
            const order = allOrdersData.find(o => String(o.id) === String(orderId));
            if(!order) return;

            let html = '';

            if(order.warehouse_name === 'داخلی') {
                const purchaseDisplay = formatPurchaseNumber(order.purchase_number);
                const purchaseValueHtml = purchaseDisplay !== '-'
                    ? `<button type="button" class="info-value-pill info-value-copy purchase-value-pill" title="شماره خرید (سرور)" onclick="copyToClipboard('${escapeAttr(purchaseDisplay)}', 'شماره خرید در حافظه کپی شد')"><span>${escapeHtml(purchaseDisplay)}</span></button>`
                    : `<span class="info-value-pill info-value-static purchase-value-pill"><span>${escapeHtml(purchaseDisplay)}</span></span>`;

                html += `
                    <div class="info-section-title">اطلاعات تکمیلی خرید</div>
                    <div class="info-detail-grid polished-info-grid">
                        <div class="info-detail-item polished-info-item">
                            <span class="info-detail-label">شماره خرید (سرور)</span>
                            ${purchaseValueHtml}
                        </div>
                        <div class="info-detail-item polished-info-item">
                            <span class="info-detail-label">مدت زمان گارانتی</span>
                            <span class="info-value-pill info-value-static warranty-value-pill"><span>${escapeHtml(formatWarrantyValue(order.warranty))}</span></span>
                        </div>
                    </div>
                `;
            }

            if(order.related_invoices) {
                const relatedItems = splitCommaList(order.related_invoices)
                    .map(item => `<span class="info-related-chip">${escapeHtml(item)}</span>`)
                    .join('');

                html += `
                    <div class="info-section-title">فاکتورهای وابسته</div>
                    <div class="info-related-list">${relatedItems}</div>
                `;
            }


            showInfoModal(
                `اطلاعات فاکتور ${order.invoice_number}`,
                html || `<div class="info-text-card">موردی ثبت نشده است.</div>`,
                {
                    html: true,
                    icon: 'ℹ',
                    subtitle: ''
                }
            );
        }

        function closeInfoModal() {
            document.getElementById('infoModal').style.display = 'none';
        }

        async function loadServerDateTime() {
            try {
                const res = await apiFetch(`${API_URL}/server-time`);
                const data = await res.json();
                currentServerDatePart = (data.formatted_date || '').split(' - ')[0].trim();
            } catch (e) {
                console.error(e);
            }
        }

        async function refreshCurrentServerDatePart() {
            try {
                const res = await apiFetch(`${API_URL}/server-time`);
                const data = await res.json();
                currentServerDatePart = (data.formatted_date || '').split(' - ')[0].trim();
            } catch (e) {
                console.error(e);
            }
        }

        async function openOrderModal() {
            if (!requireClientPermission('orders.create')) return;
            document.getElementById('orderModal').style.display = 'flex';
            await loadServerDateTime();
        }

        function closeOrderModal() {
            document.getElementById('orderModal').style.display = 'none';
            clearOrderFormState();
        }



        const PERSIAN_MONTH_NAMES = {
            '01': 'فروردین',
            '02': 'اردیبهشت',
            '03': 'خرداد',
            '04': 'تیر',
            '05': 'مرداد',
            '06': 'شهریور',
            '07': 'مهر',
            '08': 'آبان',
            '09': 'آذر',
            '10': 'دی',
            '11': 'بهمن',
            '12': 'اسفند'
        };

        function gregorianToJalaliClient(gy, gm, gd) {
            const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            let jy = gy <= 1600 ? 0 : 979;
            gy -= gy <= 1600 ? 621 : 1600;
            const gy2 = gm > 2 ? gy + 1 : gy;
            let days = 365 * gy
                + Math.floor((gy2 + 3) / 4)
                - Math.floor((gy2 + 99) / 100)
                + Math.floor((gy2 + 399) / 400)
                - 80
                + gd
                + gDaysInMonth[gm - 1];

            jy += 33 * Math.floor(days / 12053);
            days %= 12053;
            jy += 4 * Math.floor(days / 1461);
            days %= 1461;

            if (days > 365) {
                jy += Math.floor((days - 1) / 365);
                days = (days - 1) % 365;
            }

            const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
            const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
            return [jy, jm, jd];
        }

        function toJalaliDateFromDateInput(value) {
            if (!value) return '';
            const parts = String(value).split('-').map(Number);
            if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
            const [jy, jm, jd] = gregorianToJalaliClient(parts[0], parts[1], parts[2]);
            return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
        }



        let activeJalaliPickerInputId = '';
        let activeJalaliPickerYear = 0;
        let activeJalaliPickerMonth = 0;

        function isJalaliLeapYear(jy) {
            const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
            let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
            if (jy < jp || jy >= breaks[bl - 1]) return false;
            for (i = 1; i < bl; i += 1) {
                jm = breaks[i];
                jump = jm - jp;
                if (jy < jm) break;
                leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
                jp = jm;
            }
            n = jy - jp;
            leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
            if ((jump % 33) === 4 && jump - n === 4) leapJ += 1;
            const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
            leap = (((leapJ - leapG) % 33) + 33) % 33;
            return leap === 1 || leap === 5 || leap === 9 || leap === 13 || leap === 17 || leap === 22 || leap === 26 || leap === 30;
        }

        function getJalaliMonthLength(jy, jm) {
            if (jm <= 6) return 31;
            if (jm <= 11) return 30;
            return isJalaliLeapYear(jy) ? 30 : 29;
        }

        function jalaliToGregorianClient(jy, jm, jd) {
            jy = Number(jy); jm = Number(jm); jd = Number(jd);
            jy += 1595;
            let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd;
            days += (jm < 7) ? ((jm - 1) * 31) : (((jm - 7) * 30) + 186);
            let gy = 400 * Math.floor(days / 146097);
            days %= 146097;
            if (days > 36524) {
                gy += 100 * Math.floor(--days / 36524);
                days %= 36524;
                if (days >= 365) days++;
            }
            gy += 4 * Math.floor(days / 1461);
            days %= 1461;
            if (days > 365) {
                gy += Math.floor((days - 1) / 365);
                days = (days - 1) % 365;
            }
            let gd = days + 1;
            const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let gm;
            for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
            return [gy, gm, gd];
        }

        function getTodayJalaliParts() {
            const now = new Date();
            const [jy, jm, jd] = gregorianToJalaliClient(now.getFullYear(), now.getMonth() + 1, now.getDate());
            return { year: jy, month: jm, day: jd };
        }

        function parseJalaliDateValue(value) {
            const match = String(value || '').match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
            if (!match) return null;
            return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
        }


        function handleDatePartInput(input, nextId = '', maxLength = 2) {
            if (!input) return;
            input.value = String(input.value || '').replace(/[^0-9]/g, '').slice(0, maxLength);
            if (nextId && input.value.length >= maxLength) {
                const next = document.getElementById(nextId);
                if (next) next.focus();
            }
        }

        function normalizeDatePartOnBlur(input, length = 2) {
            if (!input || !input.value) return;
            input.value = String(input.value).replace(/[^0-9]/g, '').padStart(length, '0').slice(-length);
        }

        function readSegmentedJalaliDate(prefix) {
            const year = document.getElementById(`${prefix}_year`)?.value || '';
            const month = document.getElementById(`${prefix}_month`)?.value || '';
            const day = document.getElementById(`${prefix}_day`)?.value || '';
            if (!year && !month && !day) return '';
            if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
                showAppToast('تاریخ باید به شکل سال ۴ رقمی، ماه ۲ رقمی و روز ۲ رقمی وارد شود.', 'error');
                return '';
            }
            return `${year}/${month}/${day}`;
        }

        function clearSegmentedJalaliDate(prefix) {
            [`${prefix}_year`, `${prefix}_month`, `${prefix}_day`].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }

        function openJalaliDatePicker(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;
            activeJalaliPickerInputId = inputId;
            const parsed = parseJalaliDateValue(input.value) || (currentServerDatePart ? parseJalaliDateValue(currentServerDatePart) : null) || getTodayJalaliParts();
            activeJalaliPickerYear = parsed.year;
            activeJalaliPickerMonth = parsed.month;
            renderJalaliDatePicker();
            const panel = document.getElementById('jalaliDatePickerPanel');
            const rect = input.getBoundingClientRect();
            if (panel) {
                panel.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 380)}px`;
                panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 324))}px`;
            }
        }

        function closeJalaliDatePicker() {
            const panel = document.getElementById('jalaliDatePickerPanel');
            if (panel) panel.remove();
            activeJalaliPickerInputId = '';
        }

        function changeJalaliPickerMonth(delta) {
            activeJalaliPickerMonth += delta;
            if (activeJalaliPickerMonth < 1) {
                activeJalaliPickerMonth = 12;
                activeJalaliPickerYear -= 1;
            }
            if (activeJalaliPickerMonth > 12) {
                activeJalaliPickerMonth = 1;
                activeJalaliPickerYear += 1;
            }
            renderJalaliDatePicker(true);
        }

        function selectJalaliDate(day) {
            const input = document.getElementById(activeJalaliPickerInputId);
            if (!input) return;
            input.value = `${activeJalaliPickerYear}/${String(activeJalaliPickerMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
            input.dispatchEvent(new Event('change'));
            closeJalaliDatePicker();
        }

        function clearJalaliDate() {
            const input = document.getElementById(activeJalaliPickerInputId);
            if (input) input.value = '';
            closeJalaliDatePicker();
        }

        function renderJalaliDatePicker(keepPosition = false) {
            let panel = document.getElementById('jalaliDatePickerPanel');
            const existingTop = panel?.style.top;
            const existingLeft = panel?.style.left;
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'jalaliDatePickerPanel';
                panel.className = 'jalali-picker-panel';
                document.body.appendChild(panel);
            }
            const monthName = PERSIAN_MONTH_NAMES[String(activeJalaliPickerMonth).padStart(2, '0')] || activeJalaliPickerMonth;
            const [gy, gm, gd] = jalaliToGregorianClient(activeJalaliPickerYear, activeJalaliPickerMonth, 1);
            const firstDay = new Date(gy, gm - 1, gd).getDay();
            const offset = (firstDay + 1) % 7;
            const daysCount = getJalaliMonthLength(activeJalaliPickerYear, activeJalaliPickerMonth);
            const selected = parseJalaliDateValue(document.getElementById(activeJalaliPickerInputId)?.value || '');
            const weekdayLabels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
            let daysHtml = ''.padEnd(0);
            for (let i = 0; i < offset; i++) daysHtml += '<div class="jalali-day-empty"></div>';
            for (let day = 1; day <= daysCount; day++) {
                const isSelected = selected && selected.year === activeJalaliPickerYear && selected.month === activeJalaliPickerMonth && selected.day === day;
                daysHtml += `<button type="button" class="jalali-day-btn ${isSelected ? 'is-selected' : ''}" onclick="selectJalaliDate(${day})">${day}</button>`;
            }
            panel.innerHTML = `
                <div class="jalali-picker-head">
                    <button type="button" class="jalali-picker-nav" onclick="changeJalaliPickerMonth(-1)">›</button>
                    <div class="jalali-picker-title">${escapeHtml(monthName)} ${activeJalaliPickerYear}</div>
                    <button type="button" class="jalali-picker-nav" onclick="changeJalaliPickerMonth(1)">‹</button>
                </div>
                <div class="jalali-weekdays">${weekdayLabels.map(item => `<span>${item}</span>`).join('')}</div>
                <div class="jalali-days-grid">${daysHtml}</div>
                <div class="jalali-picker-footer">
                    <button type="button" class="soft-neutral-btn" onclick="clearJalaliDate()">پاکسازی</button>
                    <button type="button" class="soft-primary-btn" onclick="closeJalaliDatePicker()">بستن</button>
                </div>
            `;
            if (keepPosition && existingTop && existingLeft) {
                panel.style.top = existingTop;
                panel.style.left = existingLeft;
            }
        }

        function getOrderDatePart(order) {
            return ((order.formatted_date || '').split(' - ')[0].trim()) || '';
        }

        function getOrderDateParts(order) {
            const datePart = getOrderDatePart(order);
            const parts = datePart.split('/');
            return {
                datePart,
                year: parts[0] || 'بدون سال',
                month: parts[1] || '00',
                day: parts[2] || '00'
            };
        }


        function sanitizeGroupId(value) {
            return String(value || '')
                .replace(/\//g, '-')
                .replace(/\s+/g, '-')
                .replace(/[^0-9A-Za-zآ-ی_-]/g, '-');
        }

        function getRememberedGroupOpen(stateStore, id, defaultOpen = false) {
            return Object.prototype.hasOwnProperty.call(stateStore, id) ? Boolean(stateStore[id]) : Boolean(defaultOpen);
        }


        function getArchiveFilters() {
            return {
                seller_id: document.getElementById('archive_seller_id')?.value || '',
                invoice_number: document.getElementById('archive_invoice_number')?.value || '',
                date: readSegmentedJalaliDate('archive_date'),
                buyer_name: normalizeText(document.getElementById('archive_buyer_name')?.value || ''),
                city_id: document.getElementById('archive_city_id')?.value || '',
                device_model: document.getElementById('archive_device_model')?.value || '',
                quantity: document.getElementById('archive_quantity')?.value || '',
                config_type: document.getElementById('archive_config_type')?.value || '',
                warehouse_id: document.getElementById('archive_warehouse_id')?.value || ''
            };
        }

        function archiveOrderMatches(order, filters) {
            const invoice = String(order.invoice_number || '');
            const buyer = normalizeText(order.buyer_name || '');
            const orderDate = getOrderDatePart(order);

            if (filters.seller_id && String(order.seller_id || '') !== String(filters.seller_id)) return false;
            if (filters.invoice_number && invoice !== String(filters.invoice_number)) return false;
            if (filters.date && orderDate !== filters.date) return false;
            if (filters.buyer_name && !buyer.includes(filters.buyer_name)) return false;
            if (filters.city_id && String(order.city_id || '') !== String(filters.city_id)) return false;
            if (filters.device_model && String(order.device_model || '') !== String(filters.device_model)) return false;
            if (filters.quantity && String(order.quantity || '') !== String(filters.quantity)) return false;
            if (filters.config_type && String(order.config_type || '') !== String(filters.config_type)) return false;
            if (filters.warehouse_id && String(order.warehouse_id || '') !== String(filters.warehouse_id)) return false;
            return true;
        }

        function getArchiveFilteredOrders() {
            const filters = getArchiveFilters();
            return allOrdersData.filter(order => archiveOrderMatches(order, filters));
        }

        function applyArchiveSearch() {
            archiveSearchApplied = true;
            renderArchive();
        }

        function clearArchiveSearch() {
            ['archive_seller_id', 'archive_invoice_number', 'archive_buyer_name', 'archive_city_id', 'archive_device_model', 'archive_quantity', 'archive_config_type', 'archive_warehouse_id'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            clearSegmentedJalaliDate('archive_date');
            archiveSearchApplied = false;
            renderArchive();
        }

        function toggleArchiveGroup(id) {
            const body = document.getElementById(`archive-body-${id}`);
            const arrow = document.getElementById(`archive-arrow-${id}`);
            if (!body) return;
            body.classList.toggle('hidden');
            const isClosed = body.classList.contains('hidden');
            archiveGroupState[id] = !isClosed;
            if (arrow) arrow.classList.toggle('is-closed', isClosed);
        }

        function renderArchiveOrdersTable(orders, groupId) {
            return `
                <div class="table-scroll-shell" style="border-radius: 0 0 18px 18px; box-shadow:none;">
                    <table class="orders-table archive-orders-table">
                        <colgroup>
                            <col class="col-priority">
                            <col class="col-seller">
                            <col class="col-invoice">
                            <col class="col-datetime">
                            <col class="col-buyer">
                            <col class="col-city">
                            <col class="col-model">
                            <col class="col-quantity">
                            <col class="col-config">
                            <col class="col-warehouse">
                            <col class="col-status">
                            <col class="col-action">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>اولویت</th>
                                <th>کارشناس فروش</th>
                                <th class="invoice-header">شماره فاکتور</th>
                                <th>تاریخ و ساعت</th>
                                <th>نام خریدار</th>
                                <th>شهر</th>
                                <th>مدل سرور</th>
                                <th>تعداد</th>
                                <th>نوع کانفیگ</th>
                                <th>انبار</th>
                                <th>وضعیت</th>
                                <th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(order => {
                                const hasExtraInfo = order.related_invoices || order.warehouse_name === 'داخلی';
                                const safeStatus = order.status || 'Pending';
                                return `
                                    <tr class="status-${escapeAttr(safeStatus)}">
                                        <td><span class="font-black">${escapeHtml(order.priority)}</span></td>
                                        <td>${highlightSearchText(order.seller_name || '-')}</td>
                                        <td class="invoice-cell">
                                            ${hasExtraInfo
                                                ? `<span class="clickable-invoice" onclick="showExtraInfo('${order.id}')">${highlightSearchText(order.invoice_number)}</span>`
                                                : `<span class="text-slate-800">${highlightSearchText(order.invoice_number)}</span>`}
                                        </td>
                                        <td class="text-slate-600 datetime-ltr">${highlightSearchText(order.formatted_date || '-')}</td>
                                        <td>${highlightSearchText(order.buyer_name || '-')}</td>
                                        <td>${highlightSearchText(order.city_name || '-')}</td>
                                        <td>${highlightSearchText(order.model_name || '-')}</td>
                                        <td class="font-black">${escapeHtml(order.quantity)}</td>
                                        <td>${escapeHtml(order.config_type || '-')}</td>
                                        <td>${highlightSearchText(order.warehouse_name || '-')}</td>
                                        <td><span class="status-badge ${getStatusBadgeClass(safeStatus)}">${highlightSearchText(getStatusLabel(safeStatus))}</span></td>
                                        <td>
                                            <div class="row-actions">
                                                <button onclick="openOpsModalById('${order.id}')" class="manage-btn">مدیریت</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        function renderArchive() {
            const container = document.getElementById('archiveContainer');
            if (!container) return;
            const orders = getArchiveFilteredOrders();
            container.innerHTML = '';

            if (!orders.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><span data-portal-icon="archive"></span></div>
                        <div class="text-slate-800 font-black text-lg mb-2">موردی در آرشیو پیدا نشد</div>
                        <div class="text-sm">فیلترهای جستجوی پیشرفته را تغییر دهید یا پاکسازی کنید.</div>
                    </div>
                `;
                return;
            }

            const grouped = {};
            orders.forEach(order => {
                const parts = getOrderDateParts(order);
                if (!grouped[parts.year]) grouped[parts.year] = {};
                if (!grouped[parts.year][parts.month]) grouped[parts.year][parts.month] = {};
                if (!grouped[parts.year][parts.month][parts.day]) grouped[parts.year][parts.month][parts.day] = [];
                grouped[parts.year][parts.month][parts.day].push(order);
            });

            const years = Object.keys(grouped).sort((a, b) => String(b).localeCompare(String(a), 'fa'));
            container.innerHTML = years.map(year => {
                const yearOrdersCount = Object.values(grouped[year]).reduce((sum, monthObj) => sum + Object.values(monthObj).reduce((s, arr) => s + arr.length, 0), 0);
                const yearId = sanitizeGroupId(`year-${year}`);
                const isYearOpen = getRememberedGroupOpen(archiveGroupState, yearId, false);
                const months = Object.keys(grouped[year]).sort((a, b) => Number(b) - Number(a));
                return `
                    <div class="archive-group-card">
                        <button type="button" class="archive-group-header" onclick="toggleArchiveGroup('${yearId}')">
                            <span class="archive-title-with-count"><span>${escapeHtml(year)}</span><span class="archive-count-chip">${yearOrdersCount} فاکتور</span></span>
                            <span class="flex items-center gap-2">
                                <span id="archive-arrow-${yearId}" class="group-arrow ${isYearOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                            </span>
                        </button>
                        <div id="archive-body-${yearId}" class="archive-group-body ${isYearOpen ? '' : 'hidden'}">
                            ${months.map(month => {
                                const monthOrdersCount = Object.values(grouped[year][month]).reduce((sum, arr) => sum + arr.length, 0);
                                const monthId = sanitizeGroupId(`${yearId}-month-${month}`);
                                const isMonthOpen = getRememberedGroupOpen(archiveGroupState, monthId, false);
                                const days = Object.keys(grouped[year][month]).sort((a, b) => Number(b) - Number(a));
                                return `
                                    <div class="archive-month-card">
                                        <button type="button" class="archive-group-header" onclick="toggleArchiveGroup('${monthId}')">
                                            <span class="archive-title-with-count"><span>${escapeHtml(year)}/${escapeHtml(month)}</span><span class="archive-count-chip">${monthOrdersCount} فاکتور</span></span>
                                            <span class="flex items-center gap-2">
                                                <span id="archive-arrow-${monthId}" class="group-arrow ${isMonthOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                                            </span>
                                        </button>
                                        <div id="archive-body-${monthId}" class="archive-group-body ${isMonthOpen ? '' : 'hidden'}">
                                            ${days.map(day => {
                                                const dayId = sanitizeGroupId(`${monthId}-day-${day}`);
                                                const dayOrders = grouped[year][month][day];
                                                const isDayOpen = getRememberedGroupOpen(archiveGroupState, dayId, false);
                                                return `
                                                    <div class="archive-day-card">
                                                        <button type="button" class="archive-group-header" onclick="toggleArchiveGroup('${dayId}')">
                                                            <span class="archive-title-with-count"><span>${escapeHtml(year)}/${escapeHtml(month)}/${escapeHtml(day)}</span><span class="archive-count-chip">${dayOrders.length} فاکتور</span></span>
                                                            <span class="flex items-center gap-2">
                                                                <span id="archive-arrow-${dayId}" class="group-arrow ${isDayOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                                                            </span>
                                                        </button>
                                                        <div id="archive-body-${dayId}" class="${isDayOpen ? '' : 'hidden'}">
                                                            ${renderArchiveOrdersTable(dayOrders, dayId)}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function setSegmentedJalaliDate(prefix, value) {
            const parts = String(value || '').split('/');
            const yearEl = document.getElementById(`${prefix}_year`);
            const monthEl = document.getElementById(`${prefix}_month`);
            const dayEl = document.getElementById(`${prefix}_day`);
            if (yearEl) yearEl.value = parts[0] || '';
            if (monthEl) monthEl.value = parts[1] || '';
            if (dayEl) dayEl.value = parts[2] || '';
        }

        function makeJalaliDate(year, month, day) {
            return `${Number(year)}/${String(Number(month)).padStart(2, '0')}/${String(Number(day)).padStart(2, '0')}`;
        }

        function jalaliDateNumber(value) {
            const match = String(value || '').match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
            if (!match) return 0;
            return Number(`${match[1]}${match[2]}${match[3]}`);
        }

        function getCurrentReportBaseParts() {
            return parseJalaliDateValue(currentServerDatePart) || getTodayJalaliParts();
        }

        function getReportSelectedYear() {
            const startDate = readSegmentedJalaliDate('report_start_date');
            const parsed = parseJalaliDateValue(startDate) || getCurrentReportBaseParts();
            return parsed.year;
        }

        function setReportMonthRange(year, month, shouldRender = true) {
            const lastDay = getJalaliMonthLength(Number(year), Number(month));
            setSegmentedJalaliDate('report_start_date', makeJalaliDate(year, month, 1));
            setSegmentedJalaliDate('report_end_date', makeJalaliDate(year, month, lastDay));
            reportDateInitialized = true;
            reportDrillPath = [];
            if (shouldRender) renderReports();
        }

        function ensureReportDefaultRange(force = false) {
            if (reportDateInitialized && !force) return;
            const parts = getCurrentReportBaseParts();
            setReportMonthRange(parts.year, parts.month, false);
        }

        async function initializeReportsPage() {
            ensureReportDefaultRange(false);
            await loadOrders();
        }

        async function setReportsToCurrentServerMonth() {
            if (!currentServerDatePart) await refreshCurrentServerDatePart();
            ensureReportDefaultRange(true);
            renderReports();
        }

        function applyReportDateRange() {
            reportDateInitialized = true;
            reportDrillPath = [];
            renderReports();
        }

        const REPORT_DRILL_LEVELS = [
            {
                key: 'status',
                label: 'وضعیت فاکتور',
                value: order => order.status || 'Pending',
                display: value => getStatusLabel(value)
            },
            {
                key: 'seller',
                label: 'کارشناس فروش',
                value: order => order.seller_name || 'بدون کارشناس فروش',
                display: value => value || 'بدون کارشناس فروش'
            },
            {
                key: 'model',
                label: 'مدل سرور',
                value: order => order.model_name || 'بدون مدل',
                display: value => value || 'بدون مدل'
            },
            {
                key: 'city',
                label: 'شهر',
                value: order => order.city_name || 'بدون شهر',
                display: value => value || 'بدون شهر'
            },
            {
                key: 'warehouse',
                label: 'انبار',
                value: order => order.warehouse_name || 'بدون انبار',
                display: value => value || 'بدون انبار'
            },
            {
                key: 'config',
                label: 'نوع کانفیگ',
                value: order => order.config_type || 'بدون نوع کانفیگ',
                display: value => value || 'بدون نوع کانفیگ'
            }
        ];

        const REPORT_PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#7c3aed', '#be123c', '#0f766e', '#9333ea', '#65a30d', '#ea580c'];

        function getReportDateRange() {
            const startDate = readSegmentedJalaliDate('report_start_date');
            const endDate = readSegmentedJalaliDate('report_end_date');
            if (!startDate || !endDate) {
                showAppToast('برای گزارش، تاریخ شروع و پایان را کامل وارد کنید.', 'error');
                return null;
            }
            const startNumber = jalaliDateNumber(startDate);
            const endNumber = jalaliDateNumber(endDate);
            if (!startNumber || !endNumber) {
                showAppToast('فرمت تاریخ گزارش معتبر نیست.', 'error');
                return null;
            }
            if (startNumber > endNumber) {
                showAppToast('تاریخ شروع گزارش نباید بعد از تاریخ پایان باشد.', 'error');
                return null;
            }
            return { startDate, endDate, startNumber, endNumber };
        }

        function getReportOrdersInDateRange() {
            const range = getReportDateRange();
            if (!range) return [];
            return (allOrdersData || []).filter(order => {
                const dateNumber = jalaliDateNumber(getOrderDatePart(order));
                return dateNumber && dateNumber >= range.startNumber && dateNumber <= range.endNumber;
            });
        }

        function applyReportDrillFilters(orders) {
            return reportDrillPath.reduce((items, filter) => {
                const level = REPORT_DRILL_LEVELS[filter.levelIndex];
                if (!level) return items;
                return items.filter(order => String(level.value(order)) === String(filter.value));
            }, orders);
        }

        function buildReportSlices(orders, levelIndex) {
            const level = REPORT_DRILL_LEVELS[levelIndex];
            if (!level) return [];
            const grouped = new Map();
            orders.forEach(order => {
                const value = level.value(order);
                const key = String(value || '-');
                if (!grouped.has(key)) {
                    grouped.set(key, { value, label: level.display(value), count: 0, quantity: 0 });
                }
                const item = grouped.get(key);
                item.count += 1;
                item.quantity += Number(order.quantity || 0);
            });
            return Array.from(grouped.values()).sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'fa'));
        }

        function polarToCartesian(cx, cy, r, angleInDegrees) {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: cx + (r * Math.cos(angleInRadians)),
                y: cy + (r * Math.sin(angleInRadians))
            };
        }

        function describePieArc(cx, cy, r, startAngle, endAngle) {
            const start = polarToCartesian(cx, cy, r, endAngle);
            const end = polarToCartesian(cx, cy, r, startAngle);
            const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
            return [
                'M', cx, cy,
                'L', start.x, start.y,
                'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
                'Z'
            ].join(' ');
        }

        function formatPercent(value) {
            const rounded = Math.round(value * 10) / 10;
            return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
        }

        function renderReportBreadcrumb() {
            const container = document.getElementById('reportBreadcrumb');
            if (!container) return;
            const crumbs = [`<button type="button" onclick="resetReportDrill()">وضعیت فاکتور</button>`];
            reportDrillPath.forEach((item, index) => {
                crumbs.push('<span>›</span>');
                crumbs.push(`<button type="button" onclick="setReportDrillDepth(${index + 1})">${escapeHtml(item.label)}</button>`);
            });
            container.innerHTML = crumbs.join('');
        }

        function resetReportDrill() {
            reportDrillPath = [];
            renderReports();
        }

        function setReportDrillDepth(depth) {
            reportDrillPath = reportDrillPath.slice(0, Math.max(0, Number(depth) || 0));
            renderReports();
        }

        function goBackReportDrill() {
            reportDrillPath.pop();
            renderReports();
        }

        function drillReportSlice(index) {
            const slice = reportCurrentSlices[Number(index)];
            const levelIndex = reportDrillPath.length;
            const level = REPORT_DRILL_LEVELS[levelIndex];
            if (!slice || !level) return;
            if (levelIndex >= REPORT_DRILL_LEVELS.length - 1) {
                showAppToast('این آخرین سطح جزئیات نمودار است.', 'info');
                return;
            }
            reportDrillPath.push({ levelIndex, value: slice.value, label: `${level.label}: ${slice.label}` });
            renderReports();
        }

        function renderReportPieChart(slices) {
            const container = document.getElementById('reportChartContainer');
            if (!container) return;
            const total = slices.reduce((sum, item) => sum + item.count, 0);
            if (!total) {
                container.innerHTML = `
                    <div class="report-empty-state">
                        <div>
                            <div class="empty-icon">◌</div>
                            <div>برای این بازه زمانی داده‌ای وجود ندارد.</div>
                            <div class="text-xs text-slate-400 mt-1">بازه تاریخ را تغییر دهید یا گزارش‌ها را بروزرسانی کنید.</div>
                        </div>
                    </div>
                `;
                return;
            }

            let currentAngle = 0;
            const cx = 180;
            const cy = 180;
            const r = 150;
            const svgParts = [];
            const legendParts = [];
            slices.forEach((slice, index) => {
                const percent = (slice.count / total) * 100;
                const angle = (slice.count / total) * 360;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angle;
                const color = REPORT_PIE_COLORS[index % REPORT_PIE_COLORS.length];
                const labelAngle = startAngle + angle / 2;
                const labelPoint = polarToCartesian(cx, cy, 92, labelAngle);
                if (slices.length === 1) {
                    svgParts.push(`<circle class="report-pie-slice" cx="${cx}" cy="${cy}" r="${r}" fill="${color}" onclick="drillReportSlice(${index})"></circle>`);
                    svgParts.push(`<text class="report-pie-percent" x="${cx}" y="${cy}">100%</text>`);
                } else {
                    svgParts.push(`<path class="report-pie-slice" d="${describePieArc(cx, cy, r, startAngle, endAngle)}" fill="${color}" onclick="drillReportSlice(${index})"></path>`);
                    if (percent >= 5) {
                        svgParts.push(`<text class="report-pie-percent" x="${labelPoint.x}" y="${labelPoint.y}">${formatPercent(percent)}</text>`);
                    }
                }
                legendParts.push(`
                    <button type="button" class="report-legend-item" onclick="drillReportSlice(${index})" title="${escapeAttr(slice.label)}">
                        <span class="report-legend-dot" style="background:${color}"></span>
                        <span class="report-legend-label">${escapeHtml(slice.label)}</span>
                        <span class="report-legend-value">${slice.count} فاکتور · ${formatPercent(percent)}</span>
                    </button>
                `);
                currentAngle = endAngle;
            });

            container.innerHTML = `
                <div class="report-chart-layout">
                    <div class="report-pie-wrap">
                        <svg class="report-pie-svg" viewBox="0 0 360 360" role="img" aria-label="نمودار دایره‌ای گزارش فاکتورها">
                            ${svgParts.join('')}
                        </svg>
                    </div>
                    <div class="report-legend-list">
                        ${legendParts.join('')}
                    </div>
                </div>
            `;
        }

        function updateReportSummary(orders) {
            const total = orders.length;
            const quantity = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
            const completed = orders.filter(order => order.status === 'Completed').length;
            const completedPercent = total ? Math.round((completed / total) * 100) : 0;
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = value;
            };
            setText('reportTotalOrders', total);
            setText('reportTotalQuantity', quantity);
            setText('reportCompletedOrders', completed);
            setText('reportCompletedPercent', `${completedPercent}%`);
        }

        function renderReports() {
            if (activePage !== 'reports') return;
            ensureReportDefaultRange(false);
            const allRangeOrders = getReportOrdersInDateRange();
            updateReportSummary(allRangeOrders);
            const visibleOrders = applyReportDrillFilters(allRangeOrders);
            const currentLevelIndex = Math.min(reportDrillPath.length, REPORT_DRILL_LEVELS.length - 1);
            const currentLevel = REPORT_DRILL_LEVELS[currentLevelIndex];
            reportCurrentSlices = buildReportSlices(visibleOrders, currentLevelIndex);

            const title = document.getElementById('reportChartTitle');
            const subtitle = document.getElementById('reportChartSubtitle');
            const backBtn = document.getElementById('reportBackBtn');
            const range = getReportDateRange();
            if (title) title.innerText = reportDrillPath.length ? `زیرمجموعه بر اساس ${currentLevel.label}` : 'نمودار وضعیت فاکتورها';
            if (subtitle) {
                const rangeText = range ? `بازه ${range.startDate} تا ${range.endDate}` : 'بازه نامعتبر';
                const pathText = reportDrillPath.length ? ` | مسیر: ${reportDrillPath.map(item => item.label).join(' ← ')}` : '';
                subtitle.innerText = `${rangeText}${pathText} | روی هر رنگ کلیک کنید تا سطح بعدی همین نمودار نمایش داده شود.`;
            }
            if (backBtn) backBtn.style.display = reportDrillPath.length ? '' : 'none';
            renderReportBreadcrumb();
            renderReportPieChart(reportCurrentSlices);
        }

        function renderAccountSettings() {
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = value || '-';
            };
            setText('accountFullName', currentUser?.full_name);
            setText('accountUsername', currentUser?.username);
            setText('accountRole', currentUser?.role_name || roleLabel(currentUser?.role));
        }

        async function handleAccountPasswordChange(event) {
            event.preventDefault();
            const form = document.getElementById('accountPasswordForm');
            if (form && !form.checkValidity()) {
                showAppToast('لطفاً هر سه فیلد رمز عبور را کامل کنید.', 'error');
                return;
            }
            if (!requireClientPermission('account.change_password')) return;
            const currentPassword = document.getElementById('account_current_password').value;
            const newPassword = document.getElementById('account_new_password').value;
            const confirmPassword = document.getElementById('account_confirm_password').value;

            if (newPassword.length < 4) {
                showAppToast('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showAppToast('رمز عبور جدید و تکرار آن یکسان نیست.');
                return;
            }

            const btn = document.getElementById('accountPasswordBtn');
            const original = btn.innerText;
            btn.innerText = 'در حال ثبت...';
            btn.disabled = true;
            try {
                const res = await apiFetch(`${API_URL}/account/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
                });
                const data = await res.json();
                if (!res.ok) {
                    showAppToast(data.error || 'خطا در تغییر رمز عبور');
                    return;
                }
                document.getElementById('accountPasswordForm').reset();
                showAppToast('رمز عبور با موفقیت تغییر کرد.');
            } catch (e) {
                showAppToast('خطا در ارتباط با سرور');
            } finally {
                btn.innerText = original;
                btn.disabled = false;
            }
        }

        async function loadActivityLogUsers() {
            if (activityLogUsersLoaded) return;
            const select = document.getElementById('log_user_id');
            if (!select) return;
            select.innerHTML = '<option value="">همه کاربران</option>';
            try {
                const res = await apiFetch(`${API_URL}/activity-logs/users`);
                if (!res.ok) return;
                const users = await res.json();
                users.forEach(user => {
                    select.innerHTML += `<option value="${escapeAttr(user.id)}">${escapeHtml(user.full_name || '-')} (${escapeHtml(user.username || '-')})</option>`;
                });
                activityLogUsersLoaded = true;
            } catch (e) { console.error(e); }
        }

        async function loadActivityLogs() {
            const container = document.getElementById('logsContainer');
            if (!container) return;
            container.innerHTML = '<div class="mini-empty-state">در حال دریافت لاگ‌ها...</div>';
            try {
                if (!currentServerDatePart) await refreshCurrentServerDatePart();
                const params = new URLSearchParams();
                const userId = document.getElementById('log_user_id')?.value || '';
                const invoice = document.getElementById('log_invoice_number')?.value || '';
                const date = readSegmentedJalaliDate('log_date');
                if (userId) params.set('user_id', userId);
                if (invoice) params.set('invoice_number', invoice);
                if (date) params.set('date', date);

                const res = await apiFetch(`${API_URL}/activity-logs?${params.toString()}`);
                const logs = await res.json();
                if (!res.ok) {
                    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><span data-portal-icon="triangle-alert"></span></div><div class="text-slate-800 font-black text-lg mb-2">خطا در دریافت لاگ‌ها</div><div class="text-sm">${escapeHtml(logs.error || 'ارتباط با سرور بررسی شود.')}</div></div>`;
                    return;
                }
                renderActivityLogs(logs);
            } catch (e) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon"><span data-portal-icon="triangle-alert"></span></div><div class="text-slate-800 font-black text-lg mb-2">خطا در دریافت لاگ‌ها</div><div class="text-sm">ارتباط با سرور بررسی شود.</div></div>';
            }
        }

        function clearActivityLogFilters() {
            ['log_user_id', 'log_invoice_number'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            clearSegmentedJalaliDate('log_date');
            loadActivityLogs();
        }

        function translateLogAction(actionType) {
            const map = {
                'order.created': 'ثبت فاکتور',
                'order.updated': 'ویرایش فاکتور',
                'order.deleted': 'حذف فاکتور',
                'order.status_changed': 'تغییر وضعیت',
                'order.serials_updated': 'مدیریت سریال',
                'order.serial_copied': 'کپی سریال',
                'order.technical_notes_updated': 'توضیحات فنی',
                'order.technical_note_created': 'ثبت توضیح فنی',
                'order.technical_note_updated': 'ویرایش توضیح فنی',
                'order.technical_note_deleted': 'حذف توضیح فنی',
                'order.seller_notes_updated': 'توضیحات فروشنده',
                'order.seller_note_created': 'ثبت توضیح فروشنده',
                'order.seller_note_updated': 'ویرایش توضیح فروشنده',
                'order.seller_note_deleted': 'حذف توضیح فروشنده',
                'order.technicians_updated': 'تخصیص تکنسین',
                'order.related_updated': 'فاکتور وابسته',
                'order.technical_description_updated': 'شرح فنی',
                'order.priority_changed': 'تغییر اولویت',
                'user.created': 'ساخت کاربر',
                'user.updated': 'مدیریت کاربر',
                'user.deactivated': 'حذف کاربر',
                'user.priority_changed': 'ترتیب کاربر'
            };
            return map[actionType] || actionType || '-';
        }

        function safeJsonParse(value) {
            if (!value) return {};
            if (typeof value === 'object') return value;
            try { return JSON.parse(value); } catch (e) { return {}; }
        }

        function formatReadableValue(value) {
            if (Array.isArray(value)) {
                return value.map(item => {
                    if (item && typeof item === 'object') {
                        if (item.label && (item.from !== undefined || item.to !== undefined)) {
                            return `${item.label}:\nقبل: ${item.from ?? '-'}\nبعد: ${item.to ?? '-'}`;
                        }
                        if (item.action && item.text) return `${item.action}: ${item.text}`;
                        if (item.action && (item.from !== undefined || item.to !== undefined)) return `${item.action}:\nقبل: ${item.from ?? '-'}\nبعد: ${item.to ?? '-'}`;
                        return Object.entries(item).map(([k, v]) => `${translateLogDetailKey(k)}: ${formatReadableValue(v)}`).join('\n');
                    }
                    return String(item ?? '-');
                }).join('\n');
            }
            if (value && typeof value === 'object') {
                return Object.entries(value).map(([k, v]) => `${translateLogDetailKey(k)}: ${formatReadableValue(v)}`).join('\n');
            }
            return String(value ?? '-');
        }

        function translateLogDetailKey(key) {
            const labels = {
                from: 'قبل',
                to: 'بعد',
                before: 'قبل',
                after: 'بعد',
                changed_fields: 'فیلدهای تغییر یافته',
                changes: 'تغییرات',
                lines: 'جزئیات',
                full_name: 'نام کامل',
                username: 'نام کاربری',
                roles: 'دسته‌ها',
                is_active: 'وضعیت فعال',
                serial: 'سریال',
                text: 'متن',
                action: 'عملیات',
                label: 'فیلد',
                field: 'فیلد',
                active_before: 'تکنسین‌های قبلی',
                active_after: 'تکنسین‌های جدید',
                direction: 'جهت جابه‌جایی',
                permissions_changed: 'دسترسی‌های تغییر یافته'
            };
            return labels[key] || key;
        }

        function formatLogDetails(detailsValue) {
            const details = safeJsonParse(detailsValue);
            if (!details || typeof details !== 'object' || Array.isArray(details)) return 'جزئیات بیشتری برای این فعالیت ثبت نشده است.';
            if (Array.isArray(details.lines)) return details.lines.map(line => String(line || '').trim()).filter(Boolean).join('\n');
            if (Array.isArray(details.changed_fields)) {
                return details.changed_fields.map(item => {
                    const label = item.label || item.field || 'فیلد';
                    return `${label}:\nقبل: ${item.from ?? '-'}\nبعد: ${item.to ?? '-'}`;
                }).join('\n\n');
            }
            const rows = [];
            Object.entries(details).forEach(([key, value]) => {
                const display = formatReadableValue(value);
                if (display) rows.push(`${translateLogDetailKey(key)}:\n${display}`);
            });
            return rows.length ? rows.join('\n\n') : 'جزئیات بیشتری برای این فعالیت ثبت نشده است.';
        }

        function toggleLogDetails(logId) {
            const row = document.getElementById(`log-details-${logId}`);
            if (!row) return;
            row.classList.toggle('hidden');
            if (row.classList.contains('hidden')) openLogDetailRows.delete(String(logId));
            else openLogDetailRows.add(String(logId));
        }

        function hasLogDetails(detailsValue) {
            const details = safeJsonParse(detailsValue);
            return Boolean(details && typeof details === 'object' && !Array.isArray(details) && Object.keys(details).length);
        }

        function cleanLogMessage(log = {}) {
            let message = String(log.message || '-');
            const fullName = String(log.user_full_name || '').trim();
            const username = String(log.username || '').trim();
            if (fullName && username) {
                message = message.replace(new RegExp(`^${escapeRegExp(fullName)}\\s*\\(${escapeRegExp(username)}\\)\\s*`), '');
            }
            return message || '-';
        }

        function lookupMetadataName(listName, value) {
            const raw = String(value ?? '').trim();
            if (!raw || raw === '-') return '-';
            const list = metadataStore?.[listName] || [];
            const found = list.find(item => String(item.id) === raw || String(item.name) === raw);
            return found ? found.name : raw;
        }

        function formatLogDisplayValue(field, value) {
            if (value === null || value === undefined || value === '') return '-';
            if (Array.isArray(value)) return value.map(item => formatLogDisplayValue(field, item)).filter(Boolean).join('، ') || '-';
            if (value && typeof value === 'object') {
                if (value.name) return String(value.name);
                if (value.label) return String(value.label);
                if (value.text) return String(value.text);
                return Object.entries(value).map(([k, v]) => `${translateLogDetailKey(k)}: ${formatLogDisplayValue(k, v)}`).join('\n') || '-';
            }
            const raw = String(value).trim();
            if (!raw || raw === '-') return '-';
            const normalizedField = String(field || '').trim();
            if (normalizedField === 'seller_id') return lookupMetadataName('sellers', raw);
            if (normalizedField === 'city_id') return lookupMetadataName('cities', raw);
            if (normalizedField === 'device_model') return lookupMetadataName('models', raw);
            if (normalizedField === 'warehouse_id') return lookupMetadataName('warehouses', raw);
            if (normalizedField === 'warranty') return lookupMetadataName('warranties', raw);
            if (normalizedField === 'status') return getStatusLabel(raw);
            if (normalizedField === 'role' || normalizedField === 'roles') return raw.split(',').map(item => roleLabel(item.trim())).join('، ');
            if (normalizedField === 'is_active') return ['true', '1', 'yes', 'فعال'].includes(raw.toLowerCase()) ? 'فعال' : 'غیرفعال';
            if (raw === 'true') return 'بله';
            if (raw === 'false') return 'خیر';
            return raw;
        }

        function renderLogDetailsHtml(log = {}) {
            const details = safeJsonParse(log.details);
            if (!details || typeof details !== 'object' || Array.isArray(details) || !Object.keys(details).length) {
                return '<div class="log-detail-panel"><div class="log-detail-lines">جزئیات بیشتری برای این فعالیت ثبت نشده است.</div></div>';
            }

            if (Array.isArray(details.changed_fields) && details.changed_fields.length) {
                return `
                    <div class="log-detail-panel">
                        <div class="log-detail-title">
                            <span>جزئیات تغییرات</span>
                            <span class="log-type-chip">${escapeHtml(details.changed_fields.length)} فیلد</span>
                        </div>
                        <table class="log-change-table">
                            <thead>
                                <tr>
                                    <th>فیلد</th>
                                    <th>قبل</th>
                                    <th>بعد</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.changed_fields.map(item => {
                                    const field = item.field || '';
                                    const label = item.label || translateLogDetailKey(field) || 'فیلد';
                                    return `
                                        <tr>
                                            <td><b>${escapeHtml(label)}</b></td>
                                            <td>${escapeHtml(formatLogDisplayValue(field, item.from))}</td>
                                            <td>${escapeHtml(formatLogDisplayValue(field, item.to))}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            if (Array.isArray(details.lines) && details.lines.length) {
                return `
                    <div class="log-detail-panel">
                        <div class="log-detail-title"><span>جزئیات ثبت‌شده</span></div>
                        <div class="log-detail-lines">${escapeHtml(details.lines.map(line => String(line || '').trim()).filter(Boolean).join('\n'))}</div>
                    </div>
                `;
            }

            const chips = Object.entries(details).map(([key, value]) => `
                <div class="log-detail-chip">
                    <b>${escapeHtml(translateLogDetailKey(key))}</b>
                    <span>${escapeHtml(formatLogDisplayValue(key, value))}</span>
                </div>
            `).join('');

            return `
                <div class="log-detail-panel">
                    <div class="log-detail-title"><span>اطلاعات تکمیلی</span></div>
                    <div class="log-detail-chip-grid">${chips}</div>
                </div>
            `;
        }

        function getLogDateParts(log = {}) {
            const datePart = String(log.created_at_jalali || '').split(' - ')[0].trim() || 'بدون تاریخ';
            const parts = datePart.split('/');
            return {
                datePart,
                year: parts[0] || 'بدون سال',
                month: parts[1] || '00',
                day: parts[2] || '00'
            };
        }

        function isCurrentLogDatePart(year, month, day = '') {
            const current = String(currentServerDatePart || '').split('/');
            if (!current[0]) return false;
            if (String(year) !== current[0]) return false;
            if (month && String(month).padStart(2, '0') !== current[1]) return false;
            if (day && String(day).padStart(2, '0') !== current[2]) return false;
            return true;
        }

        function toggleActivityGroup(id) {
            const body = document.getElementById(`log-body-${id}`);
            const arrow = document.getElementById(`log-arrow-${id}`);
            if (!body) return;
            body.classList.toggle('hidden');
            const isClosed = body.classList.contains('hidden');
            activityGroupState[id] = !isClosed;
            if (arrow) arrow.classList.toggle('is-closed', isClosed);
        }

        function renderActivityLogRows(logs = []) {
            return `
                <div class="logs-table-wrap" style="box-shadow:none; border-radius:16px;">
                    <table class="logs-table">
                        <thead>
                            <tr>
                                <th>زمان</th>
                                <th>کاربر</th>
                                <th>نام کاربری</th>
                                <th>فاکتور</th>
                                <th>نوع فعالیت</th>
                                <th>شرح فعالیت</th>
                                <th>جزئیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => {
                                const hasDetails = hasLogDetails(log.details);
                                const detailOpen = openLogDetailRows.has(String(log.id));
                                return `
                                <tr>
                                    <td class="datetime-ltr">${escapeHtml(log.created_at_jalali || '-')}</td>
                                    <td>${escapeHtml(log.user_full_name || '-')}</td>
                                    <td>${escapeHtml(log.username || '-')}</td>
                                    <td>${escapeHtml(log.invoice_number || '-')}</td>
                                    <td><span class="log-type-chip">${escapeHtml(translateLogAction(log.action_type))}</span></td>
                                    <td class="logs-message-cell">${escapeHtml(cleanLogMessage(log))}</td>
                                    <td>${hasDetails ? `<button type="button" class="log-details-btn" onclick="toggleLogDetails('${log.id}')">مشاهده</button>` : '<span class="text-slate-400 text-[11px]">-</span>'}</td>
                                </tr>
                                ${hasDetails ? `<tr id="log-details-${log.id}" class="log-detail-row ${detailOpen ? '' : 'hidden'}">
                                    <td colspan="7">${renderLogDetailsHtml(log)}</td>
                                </tr>` : ''}
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        function renderActivityLogs(logs = []) {
            const container = document.getElementById('logsContainer');
            if (!container) return;
            if (!logs.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><span data-portal-icon="activity"></span></div>
                        <div class="text-slate-800 font-black text-lg mb-2">فعالیتی برای نمایش وجود ندارد</div>
                        <div class="text-sm">فیلترها را تغییر دهید یا بعد از انجام فعالیت جدید دوباره بررسی کنید.</div>
                    </div>
                `;
                return;
            }

            const grouped = {};
            logs.forEach(log => {
                const parts = getLogDateParts(log);
                if (!grouped[parts.year]) grouped[parts.year] = {};
                if (!grouped[parts.year][parts.month]) grouped[parts.year][parts.month] = {};
                if (!grouped[parts.year][parts.month][parts.day]) grouped[parts.year][parts.month][parts.day] = [];
                grouped[parts.year][parts.month][parts.day].push(log);
            });

            const years = Object.keys(grouped).sort((a, b) => String(b).localeCompare(String(a), 'fa'));
            container.innerHTML = years.map(year => {
                const yearCount = Object.values(grouped[year]).reduce((sum, monthObj) => sum + Object.values(monthObj).reduce((s, arr) => s + arr.length, 0), 0);
                const yearId = sanitizeGroupId(`log-year-${year}`);
                const isYearOpen = getRememberedGroupOpen(activityGroupState, yearId, isCurrentLogDatePart(year));
                const months = Object.keys(grouped[year]).sort((a, b) => Number(b) - Number(a));
                return `
                    <div class="log-year-card">
                        <button type="button" class="log-group-header" onclick="toggleActivityGroup('${yearId}')">
                            <span class="archive-title-with-count"><span>${escapeHtml(year)}</span><span class="archive-count-chip">${yearCount} لاگ</span></span>
                            <span id="log-arrow-${yearId}" class="group-arrow ${isYearOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                        </button>
                        <div id="log-body-${yearId}" class="log-group-body ${isYearOpen ? '' : 'hidden'}">
                            ${months.map(month => {
                                const monthCount = Object.values(grouped[year][month]).reduce((sum, arr) => sum + arr.length, 0);
                                const monthId = sanitizeGroupId(`${yearId}-month-${month}`);
                                const isMonthOpen = getRememberedGroupOpen(activityGroupState, monthId, isCurrentLogDatePart(year, month));
                                const days = Object.keys(grouped[year][month]).sort((a, b) => Number(b) - Number(a));
                                return `
                                    <div class="log-month-card">
                                        <button type="button" class="log-group-header" onclick="toggleActivityGroup('${monthId}')">
                                            <span class="archive-title-with-count"><span>${escapeHtml(year)}/${escapeHtml(month)}</span><span class="archive-count-chip">${monthCount} لاگ</span></span>
                                            <span id="log-arrow-${monthId}" class="group-arrow ${isMonthOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                                        </button>
                                        <div id="log-body-${monthId}" class="log-group-body ${isMonthOpen ? '' : 'hidden'}">
                                            ${days.map(day => {
                                                const dayId = sanitizeGroupId(`${monthId}-day-${day}`);
                                                const dayLogs = grouped[year][month][day];
                                                const isDayOpen = getRememberedGroupOpen(activityGroupState, dayId, isCurrentLogDatePart(year, month, day));
                                                return `
                                                    <div class="log-day-card">
                                                        <button type="button" class="log-group-header" onclick="toggleActivityGroup('${dayId}')">
                                                            <span class="archive-title-with-count"><span>${escapeHtml(year)}/${escapeHtml(month)}/${escapeHtml(day)}</span><span class="archive-count-chip">${dayLogs.length} لاگ</span></span>
                                                            <span id="log-arrow-${dayId}" class="group-arrow ${isDayOpen ? '' : 'is-closed'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>
                                                        </button>
                                                        <div id="log-body-${dayId}" class="${isDayOpen ? '' : 'hidden'}">
                                                            ${renderActivityLogRows(dayLogs)}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }


        async function loadMetadata() {
            try {
                const res = await apiFetch(`${API_URL}/metadata`);
                const data = await res.json();
                metadataStore = data || metadataStore;

                const fill = (id, list, placeholder = 'انتخاب...') => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.innerHTML = `<option value="">${placeholder}</option>`;
                    (list || []).forEach(item => el.innerHTML += `<option value="${item.id}">${escapeHtml(item.name)}</option>`);
                };

                const fillByName = (id, list, placeholder = 'انتخاب...') => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.innerHTML = `<option value="">${placeholder}</option>`;
                    (list || []).forEach(item => el.innerHTML += `<option value="${escapeAttr(item.name)}">${escapeHtml(item.name)}</option>`);
                };

                warrantyLookup = {};
                (data.warranties || []).forEach(item => {
                    warrantyLookup[String(item.id)] = item.name;
                    warrantyLookup[String(item.name)] = item.name;
                });

                TECHNICIANS = (data.technicians || []).map(item => item.name);

                fill('seller_id', data.sellers);
                fill('device_model', data.models, 'انتخاب مدل...');
                fill('city_id', data.cities);
                fill('warehouse_id', data.warehouses);
                fill('warranty', data.warranties);
                fillByName('config_type', data.config_types, 'انتخاب...');

                fill('edit_seller_id', data.sellers);
                fill('edit_device_model', data.models, 'انتخاب مدل...');
                fill('edit_city_id', data.cities);
                fill('edit_warehouse_id', data.warehouses);
                fill('edit_warranty', data.warranties);
                fillByName('edit_config_type', data.config_types, 'انتخاب...');

                fill('archive_seller_id', data.sellers, 'همه کارشناسان فروش');
                fill('archive_device_model', data.models, 'همه مدل‌ها');
                fill('archive_city_id', data.cities, 'همه شهرها');
                fill('archive_warehouse_id', data.warehouses, 'همه انبارها');
                fillByName('archive_config_type', data.config_types, 'همه نوع کانفیگ‌ها');
            } catch (e) {
                console.error(e);
            }
        }

        async function swapPriority(orderId, direction) {
            if (!requireClientPermission('orders.priority')) return;
            try {
                const res = await apiFetch(`${API_URL}/orders/${orderId}/swap`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ direction: direction })
                });
                
                if (res.ok) {
                    loadOrders();
                } else {
                    const data = await res.json();
                    showAppToast(data.error || 'خطا در جابجایی اولویت');
                }
            } catch (error) {
                console.error('Error swapping priority:', error);
            }
        }

        function handleSearch(value) {
            searchQuery = value || '';
            renderOrders();
        }

        function setStatusFilter(status) {
            activeStatusFilter = status;
            renderOrders();
        }

        function updateFilterButtons() {
            ['All', ...STATUS_OPTIONS.map(item => item.value)].forEach(status => {
                const btn = document.getElementById(`filter-${status}`);
                if (btn) btn.classList.toggle('active-filter', status === activeStatusFilter);
            });
        }

        function updateStats() {
            const total = allOrdersData.length;
            const today = allOrdersData.filter(o => ((o.formatted_date || '').split(' - ')[0].trim()) === currentServerDatePart).length;
            const progress = allOrdersData.filter(o => o.status === 'In-Progress').length;
            const completed = allOrdersData.filter(o => o.status === 'Completed').length;

            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = value;
            };

            setText('statTotal', total);
            setText('statToday', today);
            setText('statProgress', progress);
            setText('statCompleted', completed);
            setText('count-All', total);
            STATUS_OPTIONS.forEach(status => setText(`count-${status.value}`, allOrdersData.filter(o => o.status === status.value).length));
        }

        function getFilteredOrders() {
            const q = normalizeText(searchQuery);
            const currentMonth = currentServerDatePart.slice(0, 7);

            return allOrdersData.filter(order => {
                const monthOk = currentMonth && getOrderDatePart(order).startsWith(`${currentMonth}/`);
                const statusOk = activeStatusFilter === 'All' || order.status === activeStatusFilter;

                const notes = parseJsonArray(order.technical_notes).map(note => note.text).join(' ');
                const sellerExtraNotes = parseJsonArray(order.seller_notes).map(note => note.text).join(' ');
                const searchable = normalizeText([
                    order.invoice_number,
                    order.buyer_name,
                    order.city_name,
                    order.model_name,
                    order.seller_name,
                    order.warehouse_name,
                    order.config_type,
                    order.formatted_date,
                    order.seller_description,
                    sellerExtraNotes,
                    order.serials,
                    notes
                ].join(' '));

                const searchOk = !q || searchable.includes(q);

                return monthOk && statusOk && searchOk;
            });
        }

        function renderOrders() {
            updateStats();
            updateFilterButtons();

            const filteredOrders = getFilteredOrders();
            const grouped = {};
                
            filteredOrders.forEach(order => {
                const datePart = ((order.formatted_date || '').split(' - ')[0].trim()) || 'بدون تاریخ';
                if (!grouped[datePart]) grouped[datePart] = [];
                grouped[datePart].push(order);
            });
            
            const container = document.getElementById('groupedTableContainer');
            container.innerHTML = '';

            if (filteredOrders.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><span data-portal-icon="archive"></span></div>
                        <div class="text-slate-800 font-black text-lg mb-2">موردی برای نمایش پیدا نشد</div>
                        <div class="text-sm">عبارت جستجو یا فیلتر وضعیت را تغییر دهید.</div>
                    </div>
                `;
                return;
            }

            const dates = Object.keys(grouped).sort().reverse();
                
            dates.forEach((date, index) => {
                const isToday = date === currentServerDatePart;
                const safeDateId = sanitizeGroupId(date);
                const isOpen = getRememberedGroupOpen(homeGroupState, safeDateId, isToday || index === 0);

                container.innerHTML += `
                    <div id="date-card-${safeDateId}" class="date-group-card ${isOpen ? 'is-open' : 'is-closed'}">
                        <div class="date-group-header" onclick="toggleGroup('${safeDateId}')">
                            <div class="date-title">
                                <span>${isToday ? '<span class="inline-flex items-center gap-1"><span data-portal-icon="pin"></span><span>امروز</span></span>' : '<span data-portal-icon="calendar"></span>'}</span>
                                <span>${escapeHtml(date)}</span>
                                <span class="date-count">${grouped[date].length} مورد</span>
                            </div>
                            <span id="arrow-${safeDateId}" class="group-arrow ${isOpen ? 'is-open' : 'is-closed'}" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M6 9l6 6 6-6"></path>
                                </svg>
                            </span>
                        </div>

                        <div id="group-content-${safeDateId}" class="${isOpen ? '' : 'hidden'} table-scroll-shell">
                            <table class="orders-table">
                                <colgroup>
                                    <col class="col-priority">
                                    <col class="col-seller">
                                    <col class="col-invoice">
                                    <col class="col-datetime">
                                    <col class="col-buyer">
                                    <col class="col-city">
                                    <col class="col-model">
                                    <col class="col-quantity">
                                    <col class="col-config">
                                    <col class="col-warehouse">
                                    <col class="col-description">
                                    <col class="col-status">
                                    <col class="col-action">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>اولویت</th>
                                        <th>کارشناس فروش</th>
                                        <th class="invoice-header">شماره فاکتور</th>
                                        <th>تاریخ و ساعت</th>
                                        <th>نام خریدار</th>
                                        <th>شهر</th>
                                        <th>مدل سرور</th>
                                        <th>تعداد</th>
                                        <th>نوع کانفیگ</th>
                                        <th>انبار</th>
                                        <th>توضیحات فروشنده</th>
                                        <th>وضعیت</th>
                                        <th>عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${grouped[date].map(order => {
                                        const hasExtraInfo = order.related_invoices || order.warehouse_name === 'داخلی';
                                        const sellerExtraNotes = parseJsonArray(order.seller_notes).map(note => note.text).filter(Boolean).join(' ');
                                        const desc = [order.seller_description, sellerExtraNotes].filter(Boolean).join(' | ');
                                        const safeStatus = order.status || 'Pending';
                                        const isSearchResult = Boolean(String(searchQuery || '').trim());

                                        return `
                                            <tr class="status-${escapeAttr(safeStatus)} ${isSearchResult ? 'search-result-row' : ''}">
                                                <td>
                                                    <div class="priority-cell">
                                                        ${isToday && hasPermission('orders.priority') ? `
                                                            <div class="priority-arrows">
                                                                <button onclick="swapPriority(${order.id}, 'up')" class="priority-arrow-btn" aria-label="انتقال به بالا">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M18 15l-6-6-6 6"></path>
                                                                    </svg>
                                                                </button>
                                                                <button onclick="swapPriority(${order.id}, 'down')" class="priority-arrow-btn" aria-label="انتقال به پایین">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M6 9l6 6 6-6"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ` : ''}
                                                        <span>${escapeHtml(order.priority)}</span>
                                                    </div>
                                                </td>

                                                <td>${highlightSearchText(order.seller_name || '-')}</td>

                                                <td class="invoice-cell">
                                                    ${hasExtraInfo 
                                                        ? `<span class="clickable-invoice" onclick="showExtraInfo('${order.id}')">${highlightSearchText(order.invoice_number)}</span>` 
                                                        : `<span class="text-slate-800">${highlightSearchText(order.invoice_number)}</span>`}
                                                </td>

                                                <td class="text-slate-600 datetime-ltr">${highlightSearchText(order.formatted_date || '-')}</td>
                                                <td>${highlightSearchText(order.buyer_name || '-')}</td>
                                                <td>${highlightSearchText(order.city_name || '-')}</td>
                                                <td>${highlightSearchText(order.model_name || '-')}</td>
                                                <td class="font-black">${escapeHtml(order.quantity)}</td>
                                                <td class="text-slate-900">${highlightSearchText(order.config_type || '-')}</td>
                                                <td>${highlightSearchText(order.warehouse_name || '-')}</td>

                                                <td>
                                                    <div onclick="showSellerDescription('${order.id}')" class="description-container">
                                                        ${highlightSearchText(desc || '---')}
                                                    </div>
                                                </td>

                                                <td>
                                                    <span class="status-badge ${getStatusBadgeClass(safeStatus)}">${highlightSearchText(getStatusLabel(safeStatus))}</span>
                                                </td>

                                                <td>
                                                    <div class="row-actions">
                                                        <button onclick="openOpsModalById('${order.id}')" class="manage-btn">مدیریت</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });
        }

        async function loadOrders() {
            try {
                await refreshCurrentServerDatePart();

                const res = await apiFetch(`${API_URL}/orders`);
                allOrdersData = await res.json();

                renderOrders();
                if (activePage === 'archive') renderArchive();
                if (activePage === 'reports') renderReports();
            } catch (e) {
                console.error(e);
                const container = document.getElementById('groupedTableContainer');
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><span data-portal-icon="triangle-alert"></span></div>
                        <div class="text-slate-800 font-black text-lg mb-2">خطا در دریافت اطلاعات</div>
                        <div class="text-sm">ارتباط با سرور بررسی شود.</div>
                    </div>
                `;
            }
        }

        function toggleGroup(dateId) {
            const content = document.getElementById('group-content-' + dateId);
            const arrow = document.getElementById('arrow-' + dateId);
            const card = document.getElementById('date-card-' + dateId);

            content.classList.toggle('hidden');

            const isClosed = content.classList.contains('hidden');
            homeGroupState[dateId] = !isClosed;
            if (card) {
                card.classList.toggle('is-closed', isClosed);
                card.classList.toggle('is-open', !isClosed);
            }
            if (arrow) {
                arrow.classList.toggle('is-closed', isClosed);
                arrow.classList.toggle('is-open', !isClosed);
            }
        }

        async function handleOrderSubmit() {
            if (!requireClientPermission('orders.create')) return;
            const form = document.getElementById('orderForm');
            if (!form.checkValidity()) {
                showAppToast('لطفاً همه فیلدهای الزامی را کامل کنید.', 'error');
                return;
            }
            
            const data = {
                invoice_number: document.getElementById('invoice_number').value,
                buyer_name: document.getElementById('buyer_name').value,
                device_model: parseInt(document.getElementById('device_model').value),
                city_id: parseInt(document.getElementById('city_id').value),
                warehouse_id: parseInt(document.getElementById('warehouse_id').value),
                config_type: document.getElementById('config_type').value,
                seller_id: parseInt(document.getElementById('seller_id').value),
                quantity: parseInt(document.getElementById('quantity').value),
                seller_description: document.getElementById('seller_description').value,
                purchase_number: document.getElementById('purchase_number').value,
                warranty: document.getElementById('warranty').value,
                related_invoices: relInvoices.join(', ')
            };
            
            const res = await apiFetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (res.ok) { 
                document.getElementById('orderForm').reset();
                relInvoices = [];
                renderRelInvoices();
                toggleWarehouseLogic();
                closeOrderModal();
                currentServerDatePart = '';
                loadOrders(); 
            } else {
                const payload = await res.json();
                showAppToast(payload.error || 'خطا در ثبت فاکتور');
            }
        }


        function millisecondsUntilNextFiveMinuteBoundary() {
            const now = new Date();
            const next = new Date(now);
            const nextMinute = Math.floor(now.getMinutes() / 5) * 5 + 5;
            next.setMinutes(nextMinute, 0, 0);
            return Math.max(1000, next.getTime() - now.getTime());
        }

        function scheduleNextOrdersAutoRefresh() {
            ordersAutoRefreshTimer = setTimeout(async () => {
                if (!currentUser || !authToken) {
                    ordersAutoRefreshTimer = null;
                    return;
                }

                const refreshStartedAt = new Date();

                try {
                    await loadOrders();
                    if (activePage === 'archive') renderArchive();
                    updateLastRefreshTime(refreshStartedAt);
                } catch (e) {
                    console.error(e);
                } finally {
                    if (currentUser && authToken) {
                        scheduleNextOrdersAutoRefresh();
                    } else {
                        ordersAutoRefreshTimer = null;
                    }
                }
            }, millisecondsUntilNextFiveMinuteBoundary());
        }

        function setupOrdersAutoRefresh() {
            stopOrdersAutoRefresh();
            scheduleNextOrdersAutoRefresh();
        }

        function stopOrdersAutoRefresh() {
            if (ordersAutoRefreshTimer) {
                clearTimeout(ordersAutoRefreshTimer);
                clearInterval(ordersAutoRefreshTimer);
                ordersAutoRefreshTimer = null;
            }
        }

        window.addEventListener('pageshow', function(event) {
            if (event.persisted) {
                clearLoginForm();
                if (currentUser && authToken) refreshPageData(activePage || 'home');
            }
        });

        window.addEventListener('pagehide', function() {
            clearLoginForm();
            document.querySelectorAll('.modal-overlay').forEach(modal => clearFormFields(modal));
        });

        window.addEventListener('beforeunload', function() {
            clearLoginForm();
            document.querySelectorAll('.modal-overlay').forEach(modal => clearFormFields(modal));
        });

        initApp();