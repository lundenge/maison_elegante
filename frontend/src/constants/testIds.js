export const HOME = {
  emergentLink: "home-emergent-link",
};

export const AUTH = {
  registerButton: "register-submit-btn",
  userLoginButton: "user-login-btn",
  adminLoginButton: "admin-login-btn",
  logoutButton: "logout-btn",
  goToUserLogin: "goto-user-login",
  goToAdminLogin: "goto-admin-login",
  goToRegister: "goto-register",
};

export const NAV = {
  brand: "nav-brand",
  services: "nav-services",
  bookings: "nav-bookings",
  receipts: "nav-receipts",
  admin: "nav-admin",
  scan: "nav-scan",
  users: "nav-users",
  analytics: "nav-analytics",
  bookingsAdmin: "nav-admin-bookings",
  logout: "nav-logout",
};

export const SERVICES = {
  card: (id) => `service-card-${id}`,
  bookBtn: (id) => `service-book-${id}`,
};

export const BOOKING = {
  quantity: "booking-quantity",
  eventDate: "booking-event-date",
  notes: "booking-notes",
  payStripe: "booking-pay-stripe",
  payCash: "booking-pay-cash",
  confirm: "booking-confirm",
  promoInput: "booking-promo-input",
  promoApply: "booking-promo-apply",
};

export const RECEIPT = {
  downloadPdf: "receipt-download-pdf",
  share: "receipt-share",
  row: (id) => `receipt-row-${id}`,
};

export const SCAN = {
  dropzone: "scan-dropzone",
  fileInput: "scan-file-input",
  extractBtn: "scan-extract-btn",
  result: "scan-result",
};

export const ADMIN = {
  markPaid: (id) => `admin-mark-paid-${id}`,
  createAdmin: "create-admin-btn",
  deleteUser: (id) => `delete-user-${id}`,
};
