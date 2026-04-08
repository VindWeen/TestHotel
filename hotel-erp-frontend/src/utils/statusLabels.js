export const BOOKING_STATUS_LABELS = {
  Pending: "Chờ cọc",
  Confirmed: "Đã xác nhận",
  Checked_in: "Đang lưu trú",
  Checked_out_pending_settlement: "Chờ quyết toán",
  Completed: "Hoàn tất",
  Cancelled: "Đã hủy",
  NoShow: "Không đến",
};

export const INVOICE_STATUS_LABELS = {
  Draft: "Hóa đơn nháp",
  Ready_To_Collect: "Sẵn sàng thu",
  Unpaid: "Chưa thanh toán",
  Partially_Paid: "Thanh toán một phần",
  PartiallyPaid: "Thanh toán một phần",
  Paid: "Đã thanh toán",
  Refunded: "Đã hoàn tiền",
};

export const PAYMENT_STATUS_LABELS = {
  Success: "Thành công",
  Pending: "Đang xử lý",
  Failed: "Thất bại",
};

export const PAYMENT_TYPE_LABELS = {
  Booking_Deposit: "Thu cọc booking",
  CheckIn_Collection: "Thu thêm khi nhận phòng",
  Final_Settlement: "Thanh toán cuối",
  Refund: "Hoàn tiền",
  Deposit: "Thu cọc booking",
};

export const ROOM_BUSINESS_STATUS_LABELS = {
  Available: "Sẵn sàng",
  Occupied: "Đang có khách",
  Disabled: "Ngưng khai thác",
};

export const ROOM_CLEANING_STATUS_LABELS = {
  Clean: "Đã dọn",
  Dirty: "Chưa dọn",
  PendingLoss: "Chờ xử lý thất thoát",
};

export const ROOM_LIVE_STATUS_LABELS = {
  Available: "Sẵn sàng bán",
  Ready: "Sẵn sàng bán",
  Cleaning: "Đang dọn",
  Maintenance: "Bảo trì",
  Occupied: "Đang có khách",
  PendingLoss: "Chờ xử lý thất thoát",
};

export const LOSS_DAMAGE_STATUS_LABELS = {
  Pending: "Chờ xác nhận",
  Confirmed: "Đã xác nhận bồi thường",
  Waived: "Miễn bồi thường",
};

export const BOOKING_SOURCE_LABELS = {
  walk_in: "Tại quầy",
  online: "Trực tuyến",
  phone: "Điện thoại",
};

export const getBookingStatusLabel = (status) => BOOKING_STATUS_LABELS[status] || status || "Không rõ";
export const getInvoiceStatusLabel = (status) => INVOICE_STATUS_LABELS[status] || status || "Không rõ";
export const getPaymentStatusLabel = (status) => PAYMENT_STATUS_LABELS[status] || status || "Không rõ";
export const getPaymentTypeLabel = (type) => PAYMENT_TYPE_LABELS[type] || type || "Không rõ";
export const getRoomBusinessStatusLabel = (status) => ROOM_BUSINESS_STATUS_LABELS[status] || status || "Không rõ";
export const getRoomCleaningStatusLabel = (status) => ROOM_CLEANING_STATUS_LABELS[status] || status || "Không rõ";
export const getRoomLiveStatusLabel = (status) => ROOM_LIVE_STATUS_LABELS[status] || status || "Không rõ";
export const getLossDamageStatusLabel = (status) => LOSS_DAMAGE_STATUS_LABELS[status] || status || "Không rõ";
export const getBookingSourceLabel = (source) => BOOKING_SOURCE_LABELS[source] || source || "Không rõ";
