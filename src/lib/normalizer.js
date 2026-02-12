/**
 * Normalizes raw X.com and Bluesky post data into a unified FeedItem shape.
 *
 * FeedItem: {
 *   id        - "x:<tweetId>" or "bsky:<postUri>"
 *   platform  - "x" | "bsky"
 *   author    - { handle, displayName, avatarUrl }
 *   text      - post body
 *   createdAt - ISO 8601 string (stored as string for JSON serialisation)
 *   media     - [{ type, url, alt }] | undefined
 *   repostBy  - string | undefined
 *   url       - permalink
 * }
 */

// ── X.com ──────────────────────────────────────────────────────────────────

/**
 * Extract tweet entries from the raw X.com GraphQL timeline response.
 * Returns an array of raw tweet result objects.
 */
export function extractXTimelineEntries(json) {
  try {
    const instructions =
      json?.data?.home?.home_timeline_urt?.instructions ??
      json?.data?.home?.home_timeline_urt?.instructions ??
      [];

    const addEntries = instructions.find(
      (i) => i.type === 'TimelineAddEntries'
    );
    if (!addEntries) return [];

    return addEntries.entries
      .filter((e) => e.entryId?.startsWith('tweet-') || e.entryId?.startsWith('promoted'))
      .map((e) => {
        const content = e.content;
        if (content?.entryType === 'TimelineTimelineItem') {
          return content.itemContent?.tweet_results?.result;
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Normalize a single raw X.com tweet result object into a FeedItem.
 */
export function normalizeXTweet(raw) {
  try {
    // Handle tweet-with-visibility-results wrapper
    const tweet = raw.__typename === 'TweetWithVisibilityResults'
      ? raw.tweet
      : raw;

    if (!tweet?.legacy || !tweet?.core?.user_results?.result?.legacy) {
      return null;
    }

    const legacy = tweet.legacy;
    const user = tweet.core.user_results.result.legacy;
    const userId = tweet.core.user_results.result.rest_id;

    // Check for retweet
    let repostBy;
    let actualTweet = legacy;
    let actualUser = user;
    if (legacy.retweeted_status_result?.result) {
      repostBy = user.name;
      const rt = legacy.retweeted_status_result.result;
      const rtTweet = rt.__typename === 'TweetWithVisibilityResults' ? rt.tweet : rt;
      actualTweet = rtTweet.legacy;
      actualUser = rtTweet.core?.user_results?.result?.legacy ?? user;
    }

    const tweetId = actualTweet.id_str ?? legacy.id_str;

    // Extract media
    const media = (actualTweet.extended_entities?.media ?? []).map((m) => ({
      type: m.type === 'photo' ? 'image' : 'video',
      url: m.type === 'photo' ? m.media_url_https : (m.video_info?.variants?.find(v => v.content_type === 'video/mp4')?.url ?? m.media_url_https),
      alt: m.ext_alt_text ?? '',
    }));

    return {
      id: `x:${tweetId}`,
      platform: 'x',
      author: {
        handle: actualUser.screen_name,
        displayName: actualUser.name,
        avatarUrl: actualUser.profile_image_url_https?.replace('_normal', '_bigger') ?? '',
      },
      text: actualTweet.full_text ?? actualTweet.text ?? '',
      createdAt: new Date(actualTweet.created_at).toISOString(),
      media: media.length > 0 ? media : undefined,
      repostBy,
      url: `https://x.com/${actualUser.screen_name}/status/${tweetId}`,
    };
  } catch {
    return null;
  }
}

// ── Bluesky ────────────────────────────────────────────────────────────────

/**
 * Normalize a Bluesky feed view post (from app.bsky.feed.getTimeline) into a FeedItem.
 */
export function normalizeBskyPost(feedViewPost) {
  try {
    const { post, reason } = feedViewPost;
    const record = post.record;
    const author = post.author;

    // Determine repost
    let repostBy;
    if (reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
      repostBy = reason.by?.displayName || reason.by?.handle;
    }

    // Extract media from embeds
    const media = [];
    const embed = post.embed;
    if (embed?.$type === 'app.bsky.embed.images#view') {
      for (const img of embed.images) {
        media.push({
          type: 'image',
          url: img.fullsize ?? img.thumb,
          alt: img.alt ?? '',
        });
      }
    } else if (embed?.$type === 'app.bsky.embed.video#view') {
      media.push({
        type: 'video',
        url: embed.playlist ?? embed.thumbnail ?? '',
        alt: embed.alt ?? '',
      });
    } else if (embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
      const innerMedia = embed.media;
      if (innerMedia?.$type === 'app.bsky.embed.images#view') {
        for (const img of innerMedia.images) {
          media.push({
            type: 'image',
            url: img.fullsize ?? img.thumb,
            alt: img.alt ?? '',
          });
        }
      }
    }

    // Build permalink: at://did/app.bsky.feed.post/rkey → bsky.app url
    const uri = post.uri; // at://did:plc:xyz/app.bsky.feed.post/rkey
    const parts = uri.split('/');
    const rkey = parts[parts.length - 1];

    return {
      id: `bsky:${post.uri}`,
      platform: 'bsky',
      author: {
        handle: author.handle,
        displayName: author.displayName ?? author.handle,
        avatarUrl: author.avatar ?? '',
      },
      text: record?.text ?? '',
      createdAt: new Date(record?.createdAt ?? post.indexedAt).toISOString(),
      media: media.length > 0 ? media : undefined,
      repostBy,
      url: `https://bsky.app/profile/${author.handle}/post/${rkey}`,
    };
  } catch {
    return null;
  }
}
