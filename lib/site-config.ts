export const siteConfig = {
  publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.moonyafrica.com",
  appUrl: process.env.NEXT_PUBLIC_MOONY_APP_URL ?? "https://application.moony-africa.com",
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL ?? "/contact",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "contact@moonyafrica.com",
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "",
};
