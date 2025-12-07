# SEO Setup Guide for VeritasCV

This guide explains the SEO optimizations implemented and how to configure them.

## ✅ Implemented SEO Features

### 1. **Enhanced Metadata** (`app/layout.tsx`)
- Comprehensive meta tags (title, description, keywords)
- Open Graph tags for social media sharing
- Twitter Card tags
- Canonical URLs
- Robots directives
- Site verification tags

### 2. **Sitemap** (`app/sitemap.ts`)
- Automatic XML sitemap generation
- Includes all public pages
- Updates automatically

### 3. **Robots.txt** (`app/robots.ts`)
- Blocks API routes and private pages
- Points to sitemap
- Allows search engine crawling of public pages

### 4. **Structured Data (JSON-LD)**
- WebApplication schema
- Organization schema
- Breadcrumb schema (for navigation)
- Helps search engines understand your content

### 5. **Page-Specific Metadata**
- Login page metadata
- Dashboard metadata (noindex for privacy)
- Easy to extend for other pages

### 6. **Next.js Config Optimizations**
- Image optimization
- Compression enabled
- Security headers
- Performance optimizations

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Required: Your site URL
NEXT_PUBLIC_APP_URL=https://veritascv.com

# Optional: Search engine verification
GOOGLE_SITE_VERIFICATION=your_google_verification_code
YANDEX_VERIFICATION=your_yandex_code
YAHOO_SITE_VERIFICATION=your_yahoo_code

# Optional: Support email for structured data
SUPPORT_EMAIL=support@veritascv.com
```

### Social Media Links

Update `lib/seo/metadata.ts` with your social media links:

```typescript
sameAs: [
  "https://twitter.com/veritascv",
  "https://linkedin.com/company/veritascv",
  "https://github.com/veritascv",
],
```

## 📸 Required Images

Create these images in your `public` folder:

1. **`/public/og-image.png`** (1200x630px)
   - Open Graph image for social sharing
   - Should represent your brand

2. **`/public/logo.png`** (512x512px recommended)
   - Your logo for structured data

## 🚀 Next Steps

### 1. Submit to Search Engines

**Google Search Console:**
1. Go to https://search.google.com/search-console
2. Add your property
3. Verify ownership (use GOOGLE_SITE_VERIFICATION)
4. Submit sitemap: `https://veritascv.com/sitemap.xml`

**Bing Webmaster Tools:**
1. Go to https://www.bing.com/webmasters
2. Add your site
3. Submit sitemap

### 2. Test Your SEO

**Tools to use:**
- Google Rich Results Test: https://search.google.com/test/rich-results
- PageSpeed Insights: https://pagespeed.web.dev/
- Schema Markup Validator: https://validator.schema.org/
- Open Graph Debugger: https://www.opengraph.xyz/

### 3. Add More Pages

For each new page, add metadata:

```typescript
// app/your-page/metadata.ts
import { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta({
  title: "Your Page Title",
  description: "Your page description",
  keywords: ["keyword1", "keyword2"],
  path: "/your-page",
});
```

### 4. Add Structured Data to Pages

For client components, use the StructuredData component:

```tsx
import StructuredData from '@/components/StructuredData';

export default function YourPage() {
  return (
    <>
      <StructuredData type="WebApplication" />
      {/* Your page content */}
    </>
  );
}
```

## 📊 SEO Best Practices Checklist

- ✅ Meta tags (title, description, keywords)
- ✅ Open Graph tags
- ✅ Twitter Cards
- ✅ Structured data (JSON-LD)
- ✅ Sitemap
- ✅ Robots.txt
- ✅ Canonical URLs
- ✅ Mobile responsive (already done)
- ✅ Fast loading (Next.js optimizations)
- ✅ Semantic HTML (use proper heading tags)
- ⚠️ Alt text for images (add to all images)
- ⚠️ Internal linking (link between related pages)
- ⚠️ Blog/content pages (for better SEO)

## 🎯 Additional Recommendations

### 1. Content Strategy
- Add a blog section with job search tips
- Create landing pages for specific job types
- Add FAQ section

### 2. Technical SEO
- Ensure all images have alt text
- Use proper heading hierarchy (h1 → h2 → h3)
- Add internal links between pages
- Optimize page load speed

### 3. Local SEO (if applicable)
- Add location-based structured data
- Create location-specific pages

### 4. Analytics
- Set up Google Analytics
- Track page views and user behavior
- Monitor search performance

## 🔍 Monitoring

Regularly check:
- Google Search Console for indexing status
- PageSpeed Insights for performance
- Rich Results Test for structured data
- Mobile-Friendly Test

## 📝 Notes

- Dashboard pages are set to `noIndex: true` for privacy
- API routes are blocked in robots.txt
- Sitemap updates automatically when you add pages
- All metadata is centralized in `lib/seo/metadata.ts`

