# Findings — audit of `InfinitelyAsymptotic/pickindian` (branch `develop`)

Audited 2026-09-04. Working clone lives at `D:\swadesh\pickindian`.
Commits on `develop`: `415d4a7 Add Next.js project scaffolding with Prisma and Tailwind` ← `33ddd61 Initial commit`.
Repo is **private**; the machine's Git Credential Manager already holds working credentials.

## Stack (from `package.json`)

| Layer | Package / version |
|---|---|
| Framework | `next` 16.1.6, `react` / `react-dom` 19.2.3, TypeScript 5, App Router |
| Styling | `tailwindcss` ^4 via `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `framer-motion` ^12 |
| Icons | `lucide-react` |
| Data | `prisma` + `@prisma/client` ^5.22 (PostgreSQL) |
| Auth | `next-auth` ^5.0.0-beta.30 + `@auth/prisma-adapter`, `bcryptjs` |
| State / data | `zustand` ^5, `@tanstack/react-query` ^5 |
| Forms | `react-hook-form` ^7, `@hookform/resolvers`, `zod` ^4.3.6 |
| Payments (declared, **not wired anywhere in src/**) | `razorpay`, `stripe`, `@stripe/stripe-js` |
| Scripts | `dev/build/start/lint`, `db:generate`, `db:push`, `db:migrate`, `db:seed` (`tsx prisma/seed.ts`), `db:studio`, `db:reset` |

No `docker-compose.yml`, no `.env.example`, no tests, README is the stock create-next-app one.

## File tree (`src/`, 55 files, ~6,800 LOC)

```
src/app/(auth)/{login,signup,forgot-password}/page.tsx + layout.tsx
src/app/(shop)/products/page.tsx            list + filters (212 lines)
src/app/(shop)/products/[slug]/page.tsx     PDP (466)
src/app/(shop)/cart/page.tsx                (235)
src/app/(shop)/checkout/page.tsx            3-step, simulated payment (514)
src/app/(shop)/checkout/success/page.tsx
src/app/(shop)/account/{page,layout,orders,addresses,settings}
src/app/api/auth/[...nextauth]/route.ts
src/app/api/auth/signup/route.ts
src/app/api/products/route.ts               GET: filter/search/sort/paginate (137)
src/app/api/categories/route.ts             GET
src/app/page.tsx                            home (253)
src/app/layout.tsx, globals.css
src/components/ui/{button,card,input,select,textarea,badge,avatar,drawer,modal,skeleton,quantity-selector}.tsx
src/components/layout/{header,footer}.tsx
src/components/products/{product-card,product-filters}.tsx
src/components/cart/cart-drawer.tsx
src/components/providers/{index,session-provider,cart-hydration}.tsx
src/lib/auth/{config,index}.ts
src/lib/db/prisma.ts                        singleton client
src/lib/utils/{index,cn}.ts
src/store/cart-store.ts                     zustand (131)
src/types/index.ts                          Product/Category/Cart/Order/etc. (167)
src/types/next-auth.d.ts
src/middleware.ts                           protects /account /checkout /orders
prisma/schema.prisma, prisma/seed.ts (500)
```

## Data model (`prisma/schema.prisma`)

- NextAuth: `Account`, `Session`, `VerificationToken`
- `User { id, name, email @unique, emailVerified, image, password, phone, role: Role, ... }`
- `enum Role { USER ADMIN }` ← **no seller / artisan role**
- `Address`, `Category` (self-referential parent/children), `Product`, `ProductImage { url, alt, position }`, `ProductVariant { options Json }`, `Review`, `Cart`/`CartItem`, `WishlistItem`, `Order`/`OrderItem`, `Coupon`
- `Product` fields: name, slug, description, shortDesc, price/compareAt/costPrice Decimal(10,2), sku, barcode, stock, lowStock, weight, categoryId, brand, `origin String @default("India")`, isActive, isFeatured, `tags String[]`
- `enum OrderStatus { PENDING CONFIRMED PROCESSING SHIPPED OUT_FOR_DELIVERY DELIVERED CANCELLED RETURNED REFUNDED }`
- `enum PaymentStatus`, `enum DiscountType`
- **Missing vs the Swadeshi PRD:** Seller/Artisan profile, KYC, seller-owned products (no `sellerId` on Product), seller order management, admin verification queue.

## Auth (`src/lib/auth/config.ts`)

NextAuth v5, JWT session strategy (30 days), providers: Google (env `GOOGLE_CLIENT_ID/SECRET`) and Credentials (email + bcrypt password). `signIn` callback auto-creates a User row on first Google login. Pages: `/login`, `/signup`, error → `/login`, newUser → `/account`. Middleware redirects unauthenticated users on `/account`, `/checkout`, `/orders`.

## API behaviour

`GET /api/products` params: `page, limit(12), category(slug), brand, minPrice, maxPrice, inStock, featured, search, sort(newest|price-asc|price-desc|name-asc|name-desc)`. Search is Prisma `contains mode:insensitive` over name/description/brand. Returns `{ data: [...with price as number, averageRating, reviewCount], pagination: {page, limit, total, totalPages, hasMore} }`. N+1: computes avg rating per product in a loop — fine at seed scale.

`GET /api/categories` → all categories with `productCount`.

## Design tokens (`src/app/globals.css`)

```
--background #FAF7F2   --foreground #2D2A26   --muted #8B8680   --muted-foreground #6B6560
--border #E5DDD3       --border-hover #D4C9BC --card #FFFFFF    --card-hover #F5F0E8
--primary #B45309      --primary-hover #92400E --primary-foreground #FFFFFF
--secondary #F5F0E8    --secondary-hover #EBE4D8
--accent #7C2D12       --accent-hover #991B1B
--success #166534      --warning #B45309      --error #991B1B
```
Mapped into Tailwind v4 via `@theme inline`. Fonts: Geist sans/mono via `next/font`. Inputs: 8px radius, 12/16px padding, 16px font, focus ring `rgba(180,83,9,.15)`. Warm sand / terracotta — already right for a craft marketplace.

## Utilities (`src/lib/utils/index.ts`) — reuse these

`cn`, `formatPrice(price, {currency='INR', locale='en-IN'})`, `formatDate`, `slugify`, `generateOrderNumber()` (prefix `PI`), `truncate`, `getInitials`, `debounce`, `calculateDiscount(price, compareAt)`.

## Seed data (`prisma/seed.ts`) — the only dataset that exists

6 categories: electronics, toys, tools, art-craft, home-decor, fashion.
~20 products with `name, slug, description, shortDesc, price, compareAt, sku, stock, categorySlug, brand, origin ("City, State"), isFeatured, tags[], images[] (Unsplash URLs)`.

**Craft-relevant rows (ground truth for pricing comparables):**

| Product | Origin | Price / compareAt |
|---|---|---|
| Handcrafted Wooden Chess Set (sheesham) | Jaipur, Rajasthan | 4999 / 6999 |
| Wooden Building Blocks Set | Saharanpur, UP | 899 / 1299 |
| Traditional Ludo Board Game | Channapatna, Karnataka | see seed |
| Madhubani Art Print Set | Madhubani, Bihar | see seed |
| Warli Art Wall Hanging | Palghar, Maharashtra | see seed |
| Terracotta Painting Kit | Khurja, UP | see seed |
| Brass Diya Set (5) | Moradabad, UP | see seed |
| Handwoven Jute Rug | Kolkata, WB | see seed |
| Ceramic Dinner Set (blue pottery, 21 pc) | Jaipur, Rajasthan | see seed |
| Handwoven Pashmina Shawl | Srinagar, Kashmir | see seed |
| Block Print Cotton Saree | Bagru, Rajasthan | see seed |
| Kolhapuri Leather Chappals | Kolhapur, Maharashtra | see seed |
| Copper Water Bottle | Moradabad, UP | 799 / 1299 |

Seed also creates demo user `demo@pickindian.com` / `password123` (Bangalore address) and coupon `WELCOME10`. Seed **wipes all tables first**.

## Gaps versus the hackathon statement

1. No mobile app (web only).
2. No artisan / seller side at all (role enum, model, portal, KYC, listing flow, order status updates).
3. No AI.
4. No image upload / storage — images are external URLs.
5. No i18n, no voice, no TTS.
6. No B2B / RFQ / GeM export.
7. Payment libs unused; checkout simulated (as the PRD specified for MVP).
8. No Docker / compose despite PRD requirement.

## Machine state at audit time (2026-09-04)

Windows 11 Home. Present: `git` 2.55, `winget`, Python 3.14 (Windows Store). **Absent:** Node, npm, Docker, PostgreSQL, `ant` CLI. `ANTHROPIC_API_KEY` not set in the shell.

## Pre-existing issues found while building the artisan portal (2026-09-04)

- `next.config.ts` had no `images.remotePatterns`, so every seeded Unsplash image threw `next-image-unconfigured-host` on the product pages. **Fixed** (unsplash + localhost patterns added).
- `src/app/(shop)/account/orders/page.tsx` renders **hard-coded mock orders**; there is no `/api/orders` route and the checkout page never persists an order. The buyer-side "purchase" is not real yet — seed now creates 4 demo orders so the artisan orders screen has data.
- NextAuth config had no adapter wired (`@auth/prisma-adapter` is installed but unused), so for Google logins `token.id` was the Google provider id, not our cuid. **Fixed** in the `jwt` callback (looks the user up by email on sign-in).
- The `next-auth/jwt` module augmentation in `src/types/next-auth.d.ts` is not picked up by next-auth v5 beta (`token.id` types as `unknown`); casts are used where needed.
- `npm run lint` fails on **pre-existing** files: `src/components/products/product-filters.tsx` and the cart drawer/header create components during render (`react-hooks/static-components`). Not touched — outside scope; the new artisan files lint clean.
- `zod ^4` works with `@hookform/resolvers` v5 `zodResolver` — confirmed on the new forms.
