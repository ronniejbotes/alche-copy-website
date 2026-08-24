---
title: "Why Isn't My Website Showing Up on Google?"
slug: why-is-my-website-not-showing-up-on-google
meta_title: "Why Isn't My Website Showing Up on Google? 10 Causes and Fixes"
meta_description: "Run one search to find whether Google has your site at all, then work through the ten causes - from noindex tags to intent mismatch - with the fix for each."
category: SEO
read_time: 10
date: 2026-08-24
author: Position Xero
---

**There are only two versions of this problem, and they have completely different fixes.** Either Google does not have your website at all, or Google has it and is choosing to rank someone else. Most people troubleshooting this waste weeks because they never established which one they are dealing with.

Thirty seconds of diagnosis will tell you. Do this first.

## First: Run This One Search

Go to Google and search for:

```
site:yourdomain.com
```

Use your real domain, no spaces after the colon. What comes back tells you which problem you have.

**No results at all.** Google does not have your site indexed. This is an indexing problem. Go to Part One below.

**Some pages, but not the ones you care about.** Partial indexing. Also Part One, but focused on specific pages.

**All your pages are listed.** Google has your site. You are being outranked, not excluded. Skip to Part Two — and stop looking for a technical bug, because there is probably not one.

This distinction matters enormously. If you are indexed and simply outranked, no amount of technical fiddling will help. You have a competition problem, and it needs content and authority, not a robots.txt edit.

---

# Part One: Google Does Not Have Your Site

## 1. Your Site Is Too New

Google has to discover a site before it can index it. For a brand-new domain with no inbound links, this can take a few days to several weeks.

**How to tell:** The site launched recently and nothing else on this list applies.

**The fix:** Set up [Google Search Console](https://search.google.com/search-console), verify ownership, submit an XML sitemap, and use the URL Inspection tool to request indexing on your most important pages. Then get at least one real link pointing at the site — a directory listing, a supplier page, your Google Business Profile. Google finds new sites by following links; a site with zero inbound links is genuinely hard to discover.

## 2. A `noindex` Tag Is Telling Google to Stay Away

This is the single most common cause of a completely invisible site, and it is almost always an accident. Most content management systems have a "discourage search engines" checkbox used during development. Somebody forgets to untick it at launch.

**How to tell:** View the page source and search for `noindex`. In WordPress, check Settings → Reading → "Discourage search engines from indexing this site." In Search Console, the URL Inspection tool will say "Excluded by 'noindex' tag."

**The fix:** Remove the tag or untick the box, then request reindexing in Search Console. Recovery usually takes days, not weeks.

## 3. robots.txt Is Blocking the Crawler

Your `robots.txt` file tells crawlers where they may go. A single misplaced line can block your entire site.

**How to tell:** Visit `yourdomain.com/robots.txt`. If you see `Disallow: /` under `User-agent: *`, your whole site is blocked.

**The fix:** Remove the offending Disallow rule. Be careful here — blocking `/wp-admin/` is correct and normal. Blocking `/` is not.

Note the important distinction: robots.txt blocks *crawling*, `noindex` blocks *indexing*. If you block a page in robots.txt, Google cannot crawl it to discover a `noindex` tag on it — which is why pages sometimes stay indexed despite a noindex tag. Fix the robots.txt first, let Google crawl, then the noindex takes effect.

## 4. Your Site Requires JavaScript to Render Content

If your content only exists after JavaScript executes — common with React, Vue and Angular builds that render entirely client-side — Google may index an effectively empty page.

**How to tell:** In Search Console's URL Inspection tool, use "View Crawled Page" and look at the HTML Google actually received. If your headings and body copy are missing, this is your problem. Alternatively, disable JavaScript in your browser and reload.

**The fix:** Server-side rendering, static generation, or prerendering. This is a development task, not a settings change. It is also one of the most common reasons a beautiful, expensive new website produces zero organic traffic — the build looked great and was structurally invisible.

## 5. Canonical Tags Pointing Somewhere Else

A canonical tag tells Google "the real version of this page lives here." Misconfigured, it can tell Google that every page on your site is a duplicate of your homepage — so only the homepage gets indexed.

**How to tell:** View source on an unindexed page and find `rel="canonical"`. If it points to a different URL, that is why the page is not indexed on its own.

**The fix:** Each page's canonical should point to itself, unless you deliberately have duplicates.

## 6. Server, Hosting or Security Blocks

Cheap hosting sometimes rate-limits or blocks crawler traffic. Aggressive firewalls, bot protection and some CDN configurations can serve Googlebot a challenge page or a 403 instead of your content.

**How to tell:** Search Console's Crawl Stats report will show server errors or a sudden drop in crawl requests. The URL Inspection tool may report fetch failures.

**The fix:** Whitelist Googlebot in your firewall or CDN rules. Verify your server returns a clean `200` status to crawlers. If your host cannot support this, change host — this is not a problem you can outrun with content.

## 7. A Manual Action or Penalty

Rare, but decisive. If Google has issued a manual action, pages can be removed entirely.

**How to tell:** Search Console → Security & Manual Actions → Manual Actions. It will say plainly if one exists.

**The fix:** Read the stated reason, fix the underlying issue — usually spam links or thin, auto-generated content — and file a reconsideration request. Recovery takes weeks to months. This is the most common lasting damage from cheap SEO, which is why we warn against it in our [SEO pricing guide](/blog/how-much-does-seo-cost).

---

# Part Two: Google Has Your Site, But Ranks Someone Else

If `site:yourdomain.com` returned your pages, everything above is a dead end. Your problem is competitive, and these are the real causes.

## 8. You Are Ranking — Just Not on Page One

Most business owners searching their own main keyword and seeing nothing conclude they are invisible. Usually they are on page three.

**How to tell:** Search Console → Performance → filter by query. Look at "Average Position" for your target terms. Position 24 feels identical to position 200 from the front page, but they are completely different situations.

**The fix:** This is normal, and it is what SEO work addresses. Position 24 means Google understands what you are about and does not yet consider you credible enough. That is a content depth and authority problem, solved over months. Our [SEO timeline](/blog/how-long-does-seo-take) explains what to expect and when.

**Important:** do not diagnose your rankings by Googling yourself. Your results are personalised by location, history and login state. Use Search Console or an incognito window with location set to your target market.

## 9. Your Content Does Not Match Search Intent

Google ranks pages that answer the query, not pages that mention the keyword. If someone searches "emergency plumber near me," Google wants a local business with a phone number and hours — not a 2,000-word article titled "Emergency Plumbing: A Complete Guide."

**How to tell:** Search your target keyword and look at what actually ranks. Are the top ten results service pages, blog posts, directories, or product pages? If your page is a different type from all ten, you are competing in the wrong format.

**The fix:** Match the format that ranks. Commercial searches need service pages with clear offers, pricing signals, service areas and calls to action. Informational searches need genuinely useful content. Do not fight the intent — Google has already told you what it wants by showing you the results.

## 10. Nobody Searches What You Optimised For

Sometimes the page ranks perfectly for a term with almost no search volume. You are number one for something nobody types.

**How to tell:** In Search Console, look at impressions, not position. High position with near-zero impressions means the keyword has no demand.

**The fix:** Real keyword research against actual search volume. Target the phrasing your customers use, which is often not the phrasing you use internally. Customers search "AC not blowing cold," not "HVAC diagnostic services."

## Bonus: You Are Local and Not in the Map Pack

For service businesses, the map pack sits above organic results and takes a large share of the clicks. You can rank fourth organically and still be invisible, because the three map results and the ads occupy the whole first screen.

**How to tell:** Search "[your service] [your city]" and see whether you appear in the map results.

**The fix:** This is Google Business Profile work — correct categories, complete service list, defined service areas, photos, and consistent review velocity. It moves faster than organic SEO, often within four to eight weeks. Our [local SEO framework](/blog/local-seo-for-service-businesses) covers the five pillars.

## The Diagnostic Checklist

Work through these in order. Stop when you find the cause.

1. Run `site:yourdomain.com` — indexed or not?
2. Is Search Console set up and verified? If not, do this before anything else.
3. Check URL Inspection on a missing page — what does Google say about it?
4. View source: any `noindex`?
5. Check `/robots.txt`: any `Disallow: /`?
6. Check canonical tags point to themselves.
7. View the crawled HTML — is your content actually in it?
8. Check Manual Actions in Search Console.
9. If indexed: check Average Position in Search Console for your target terms.
10. If ranking but not converting: compare your page format against what actually ranks.

## Frequently Asked Questions

**How long should indexing take for a new page?**
On an established site with regular publishing, hours to a few days. On a new site with no authority, one to four weeks. Submitting through Search Console speeds up discovery but does not guarantee indexing — Google still decides whether the page is worth keeping.

**Why did my site disappear after a redesign?**
Almost always redirects. If URLs changed and old ones were not 301-redirected to their new equivalents, you lost every ranking attached to those URLs. This is the most expensive and most common redesign mistake. It is recoverable if you implement the redirects, but rankings take time to return — and it is why we treat redirect mapping as non-negotiable in [what a small business website should cost](/blog/how-much-does-a-small-business-website-cost).

**Does Google index every page?**
No. Google increasingly declines to index pages it judges low value — thin content, near-duplicates, auto-generated pages. "Crawled – currently not indexed" in Search Console usually means a quality judgement, not a bug.

**I am indexed but get no traffic. What now?**
That is a rankings and intent problem, not an indexing one. Check average position and impressions in Search Console. Low position means you need authority and content depth. Good position with low impressions means low search demand on that term.

**Will paid ads help my organic rankings?**
No. Running Google Ads has no direct effect on organic position. It does get you visible immediately while SEO builds, which is a legitimate reason to run both — see [SEO or Google Ads](/blog/seo-vs-google-ads).

## What We Would Tell You

Nine times out of ten this is one of three things: a `noindex` left on after launch, a JavaScript site Google cannot read, or — most often — a site that is perfectly indexed and simply sitting on page three.

The first two are afternoon fixes. The third is not a bug and cannot be fixed in an afternoon. It is the actual work of SEO, and anyone offering to solve it in a week is selling you something else.

Want us to run the diagnosis for you? Book a free 30-minute audit. We will tell you whether this is a technical problem you can fix yourself this week, or a competitive one — and if it is the second, what it would realistically take.

[Book My Free Strategy Call](/contact)

## Related Articles

- [Local SEO for Service Businesses](/blog/local-seo-for-service-businesses)
- [How Long Does SEO Take to Work?](/blog/how-long-does-seo-take)
- [What Is AI SEO? Complete 2026 Guide](/blog/what-is-ai-seo)
- [How Much Does SEO Cost Per Month?](/blog/how-much-does-seo-cost)
- [How Much Should a Small Business Website Cost?](/blog/how-much-does-a-small-business-website-cost)
