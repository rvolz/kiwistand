import htm from "htm";
import vhtml from "vhtml";
import { formatDistanceToNowStrict as originalFormatDistance } from "date-fns";
import { URL } from "url";
import DOMPurify from "isomorphic-dompurify";
import ethers from "ethers";
import slugify from "slugify";

import { commentCounts } from "../../store.mjs";
import ShareIcon from "./shareicon.mjs";
import CopyIcon from "./copyicon.mjs";
import FCIcon from "./farcastericon.mjs";
import theme from "../../theme.mjs";
import { countOutbounds } from "../../cache.mjs";
import log from "../../logger.mjs";

const html = htm.bind(vhtml);

const formatDistanceToNowStrict = (date) => {
  return originalFormatDistance(date)
    .replace(/ years?/, "y")
    .replace(/ months?/, "mo")
    .replace(/ weeks?/, "w")
    .replace(/ days?/, "d")
    .replace(/ hours?/, "h")
    .replace(/ minutes?/, "m")
    .replace(/ seconds?/, "s");
};

const ShuffleSVG = html`<svg
  style="width: 24px; color: black;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M32,72H55.06a64,64,0,0,1,52.08,26.8l41.72,58.4A64,64,0,0,0,200.94,184H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 48 232 72 208 96"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 160 232 184 208 208"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M147.66,100.47l1.2-1.67A64,64,0,0,1,200.94,72H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M32,184H55.06a64,64,0,0,0,52.08-26.8l1.2-1.67"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

export function extractDomain(link) {
  const parsedUrl = new URL(link);
  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

export function addOrUpdateReferrer(link, address) {
  if (!address) return link;

  const url = new URL(link);
  if (url.hostname.endsWith("mirror.xyz")) {
    url.searchParams.set("referrerAddress", address);
  } else if (
    url.hostname.endsWith("paragraph.xyz") ||
    url.hostname.endsWith("zora.co") ||
    url.hostname.endsWith("manifold.xyz")
  ) {
    url.searchParams.set("referrer", address);
  } else if (url.hostname.endsWith("foundation.app")) {
    url.searchParams.set("ref", address);
  }
  return url.toString();
}

const truncateLongWords = (text, maxLength = 20) => {
  const words = text.split(" ");
  const truncatedWords = words.map((word) =>
    word.length > maxLength ? `${word.substring(0, maxLength)}...` : word,
  );
  return truncatedWords.join(" ");
};

export function truncateComment(comment, maxLength = 260) {
  const emptyLineIndex = comment.indexOf("\n\n");
  if (emptyLineIndex !== -1 && emptyLineIndex < maxLength)
    return truncateLongWords(comment.slice(0, emptyLineIndex));

  const lastLinkStart = comment.lastIndexOf("https://", maxLength);
  if (lastLinkStart !== -1 && lastLinkStart < maxLength) {
    const breakPoint = comment.lastIndexOf(" ", lastLinkStart);
    const truncated =
      breakPoint !== -1
        ? comment.slice(0, breakPoint) + "..."
        : comment.slice(0, lastLinkStart) + "...";
    return truncateLongWords(truncated);
  }

  if (comment.length <= maxLength) return truncateLongWords(comment);
  return truncateLongWords(
    comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...",
  );
}

// NOTE: Some sites have awful OG images that we don't want to show. Notion for
// example always have the same generic ogImages, but many people often share
// Notion documents.
const blockedOGImageDomains = [
  "notion.site",
  "abs.xyz",
  "github.com",
  "https://www.railway.xyz/",
  "t.me",
];
const knownBadOgImages = [
  "https://paragraph.xyz/share/share_img.jpg",
  "https://s.turbifycdn.com/aah/paulgraham/essays-5.gif",
];

const row = (
  start = 0,
  path,
  style = "border-bottom: 1px solid rgba(0,0,0,0.1);",
  interactive,
  hideCast,
  period,
  recentJoiners,
  invert = false,
) => {
  const size = 12;
  return (story, i) => {
    try {
      // NOTE: Normally it can't happen, but when we deploy a new ad contract
      // then story can indeed be empty, and so this made several functions in
      // the row component panic, which is why we now check before we continue
      // the rendering.
      new URL(story.href);
    } catch (err) {
      log(`Fault during row render for story href: ${story.href}`);
      return;
    }

    const submissionId = `kiwi:0x${story.index}`;
    const commentCount = commentCounts.get(submissionId) || 0;
    const outboundsLookbackHours = 24 * 5;
    const clicks = countOutbounds(
      addOrUpdateReferrer(story.href, story.identity),
      outboundsLookbackHours,
    );
    const extractedDomain = extractDomain(DOMPurify.sanitize(story.href));
    const isad = !!story.collateral;
    return html`
      <tr style="${invert ? "background-color: black;" : ""}">
        <td>
          <div
            class="${interactive ? "" : "content-row"} ${
      invert ? "inverted-row" : ""
    }"
            style="${invert ? "display:none;" : ""} ${
      i === 0 ? "border-top: 1px solid rgba(0,0,0,0.1);" : ""
    }${style}"
          >
            <div style="display: flex; align-items: center;">
              <div
                data-title="${DOMPurify.sanitize(story.title)}"
                data-href="${DOMPurify.sanitize(story.href)}"
                data-upvoters="${JSON.stringify(story.upvoters)}"
                data-isad="${isad}"
                class="vote-button-container"
                style="${
                  isad ? "opacity: 0.3;" : ""
                }display: flex; align-self: stretch;"
              >
                <div
                  onclick="const key='--kiwi-news-upvoted-stories';const href='${DOMPurify.sanitize(
                    story.href,
                  )}';const title='${DOMPurify.sanitize(
      story.title,
    )}';const stories=JSON.parse(localStorage.getItem(key)||'[]');stories.push({href,title});localStorage.setItem(key,JSON.stringify(stories));window.dispatchEvent(new Event('upvote-storage'));"
                >
                  <div
                    class="interaction-element"
                    style="border-radius: 2px; padding: 5px 0; background-color: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; min-width: 40px; margin: 5px 8px 5px 6px; align-self: stretch;"
                  >
                    <div style="min-height: 40px; display:block;">
                      <div class="votearrowcontainer">
                        <div>
                          <div
                            class="votearrow"
                            style="color: rgb(130, 130, 130); cursor: pointer;"
                            title="upvote"
                          >
                            ▲
                          </div>
                          <div
                            class="upvotes-container"
                            data-href="${story.href}"
                            style="font-size: 8pt; text-align: center;"
                          >
                            ${story.upvotes ? story.upvotes : "..."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style="display: flex; align-items: start; flex-grow: 1; gap: 8px;"
              >
                ${
                  story.metadata &&
                  story.metadata.image &&
                  !interactive &&
                  !blockedOGImageDomains.includes(extractedDomain) &&
                  !knownBadOgImages.includes(story.metadata.image)
                    ? html`<a
                        href="${`/outbound?url=${encodeURIComponent(
                          addOrUpdateReferrer(
                            DOMPurify.sanitize(story.href),
                            story.identity,
                          ),
                        )}`}"
                        class="row-image"
                        target="_blank"
                        style="align-self: stretch; margin: 5px 0;"
                      >
                        <img
                          style="max-height: 61px; border: 1px solid #ccc; border-radius: 2px; width: 110px; object-fit: cover;"
                          src="${DOMPurify.sanitize(story.metadata.image)}"
                      /></a>`
                    : null
                }
                <div
                  style="min-height: 55px; display:flex; justify-content: center; flex-direction: column; flex-grow: 1; line-height: 1.3; padding: 8px 3px 5px 0;"
                >
                  <span>
                    <span class="story-link-container">
                      <a
                        href="${
                          path === "/submit" || path === "/demonstration"
                            ? "javascript:void(0);"
                            : `/outbound?url=${encodeURIComponent(
                                addOrUpdateReferrer(
                                  DOMPurify.sanitize(story.href),
                                  story.identity,
                                ),
                              )}`
                        }"
                        data-story-link="/stories/${slugify(
                          DOMPurify.sanitize(story.title),
                        )}?index=0x${story.index}"
                        target="${
                          path === "/submit" || path === "/demonstration"
                            ? "_self"
                            : "_blank"
                        }"
                        class="story-link"
                        style="line-height: 15pt; font-size: 13pt;"
                      >
                        ${
                          story.isOriginal
                            ? html`<mark
                                style="background-color: rgba(255,255,0, 0.05); padding: 0px 2px;"
                                >${truncateLongWords(
                                  DOMPurify.sanitize(story.title),
                                )}</mark
                              >`
                            : truncateLongWords(DOMPurify.sanitize(story.title))
                        }
                      </a>
                      <span> </span>
                    </span>
                    <span> </span>
                    <span class="story-domain" style="white-space: nowrap;"
                      >(${
                        !interactive && (path === "/" || path === "/best")
                          ? html`<a
                              href="${path}?domain=${extractedDomain}${period
                                ? `&period=${period}`
                                : ""}"
                              style="color: #828282;"
                              >${extractedDomain}</a
                            >`
                          : extractedDomain
                      })</span
                    >
                  </span>
                  <div style="font-size: 10pt; margin-top: 1px;">
                    <spani style="opacity: 0.8">
                      ${
                        path !== "/stories" &&
                        story.avatars.length > 3 &&
                        html`
                          <span>
                            <div
                              style="margin-left: ${size /
                              2}; top: 2px; display: inline-flex; position:relative;"
                            >
                              ${story.avatars.slice(0, 5).map(
                                (avatar, index) => html`
                                  <img
                                    loading="lazy"
                                    src="${avatar}"
                                    alt="avatar"
                                    style="z-index: ${index}; width: ${size}px; height:
 ${size}px; border: 1px solid #828282; border-radius: 2px; margin-left: -${size /
                                    2}px;"
                                  />
                                `,
                              )}
                            </div>
                            <span style="opacity:0.6"> • </span>
                          </span>
                        `
                      }
                      ${
                        story.index
                          ? html`
                              <a
                                class="meta-link"
                                href="/stories/${slugify(
                                  DOMPurify.sanitize(story.title),
                                )}?index=0x${story.index}"
                              >
                                ${formatDistanceToNowStrict(
                                  new Date(story.timestamp * 1000),
                                )}
                                <span> ago</span>
                              </a>
                            `
                          : html`
                              ${formatDistanceToNowStrict(
                                new Date(story.timestamp * 1000),
                              )}
                              <span> ago</span>
                            `
                      }
                      <span> by </span>
                      ${
                        story.identity
                          ? html`<a
                              href="${interactive
                                ? ""
                                : story.submitter && story.submitter.ens
                                ? `/${story.submitter.ens}`
                                : `/upvotes?address=${story.identity}`}"
                              class="meta-link"
                              style="${recentJoiners &&
                              recentJoiners.includes(story.identity)
                                ? `color: ${theme.color};`
                                : ""}"
                            >
                              ${story.displayName}
                            </a>`
                          : path === "/demonstration"
                          ? html`<a class="meta-link" href="javascript:void(0);"
                              >${story.displayName}</a
                            >`
                          : html`<a
                              target="_blank"
                              class="meta-link"
                              href="https://paragraph.xyz/@kiwi-updates/kiwi-feedbot-submissions-open"
                              >${story.displayName}</a
                            >`
                      }
                      ${
                        story.collateral && story.price
                          ? html`
                              <span>
                                <a
                                  class="meta-link"
                                  href="https://github.com/attestate/ad?tab=readme-ov-file#how-does-it-work"
                                  target="_blank"
                                >
                                  <span> </span>
                                  (sponsored)</a
                                >
                                <span style="opacity:0.6"> • </span>
                                <a
                                  style="display: inline;"
                                  class="meta-link"
                                  href="/submit?isad=true"
                                >
                                  <span>Price: </span>
                                  ${parseFloat(
                                    ethers.utils.formatEther(
                                      story.price.toString(),
                                    ),
                                  ).toFixed(4)}
                                  <span> </span>
                                  ETH
                                </a>
                              </span>
                            `
                          : null
                      }
                      <span>
                        ${
                          path === "/" || path === "/new"
                            ? html` <span style="opacity:0.6"> • </span>
                                <span
                                  class="click-counter"
                                  data-story-clicks="${clicks}"
                                  data-story-href="${DOMPurify.sanitize(
                                    addOrUpdateReferrer(
                                      story.href,
                                      story.identity,
                                    ),
                                  )}"
                                >
                                  ${clicks.toString()}
                                  <span> </span>
                                  ${clicks === 1 ? "click" : "clicks"}</span
                                >`
                            : null
                        }
                        ${
                          interactive || hideCast || isad
                            ? null
                            : html`
                                <span class="share-container">
                                  <span style="opacity:0.6"> • </span>
                                  <a
                                    href="#"
                                    class="caster-link share-link"
                                    title="Share"
                                    style="white-space: nowrap;"
                                    onclick="event.preventDefault(); navigator.share({url: 'https://news.kiwistand.com/stories/${slugify(
                                      DOMPurify.sanitize(story.title),
                                    )}?index=0x${story.index}' });"
                                  >
                                    ${ShareIcon(
                                      "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                    )}
                                    Share
                                  </a>
                                </span>
                              `
                        }
                        ${
                          isad ||
                          interactive ||
                          hideCast ||
                          story.displayName === "Feedbot"
                            ? null
                            : html`
                                <span class="inverse-share-container">
                                  <span style="opacity:0.6"> • </span>
                                  <a
                                    href="#"
                                    class="meta-link share-link"
                                    title="Share"
                                    style="white-space: nowrap;"
                                    onclick="event.preventDefault(); navigator.clipboard.writeText('https://news.kiwistand.com/stories/${slugify(
                                      DOMPurify.sanitize(story.title),
                                    )}?index=0x${story.index}'); window.toast.success('Link copied!');"
                                  >
                                    ${CopyIcon(
                                      "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                    )}
                                    Link
                                  </a>
                                </span>
                              `
                        }
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              ${
                path !== "/stories" &&
                path !== "/demonstration" &&
                path !== "/submit"
                  ? html`<div
                      data-story-index="0x${story.index}"
                      data-comment-count="${commentCount}"
                      class="chat-bubble-container"
                      style="${isad
                        ? "opacity: 0.3;"
                        : ""}display: flex; align-self: stretch;"
                    >
                      <a
                        class="chat-bubble interaction-element"
                        id="chat-bubble-${story.index}"
                        href="/stories/${slugify(
                          DOMPurify.sanitize(story.title),
                        )}?index=0x${story.index}"
                        style="margin: 5px; background-color: #e6e6df; border-radius: 2px; display: ${path ===
                        "/stories"
                          ? "none"
                          : "flex"}; justify-content: center; min-width: 40px; align-items: center; flex-direction: column;"
                      >
                        ${ChatsSVG()}
                        <span
                          id="comment-count-${story.index}"
                          style="color: rgba(0,0,0,0.65); font-size: 8pt;"
                          >${commentCount}</span
                        >
                      </a>
                    </div>`
                  : ""
              }
              ${
                path === "/stories"
                  ? html`<div
                      title="Go to random article"
                      style="display: flex; align-self: stretch;"
                    >
                      <a
                        class="chat-bubble interaction-element"
                        href="/random"
                        style="margin: 5px; background-color: #e6e6df; border-radius: 2px; display: flex; justify-content: center; min-width: 40px; align-items: center; flex-direction: column;"
                      >
                        ${ShuffleSVG}
                      </a>
                    </div>`
                  : ""
              }
            </div>
            ${
              story.lastComment &&
              story.lastComment.identity.safeAvatar &&
              !invert
                ? html` <div
                    class="comment-preview-0x${story.index}"
                    style="cursor: pointer; padding: 1px 5px 9px 6px; display: flex;"
                  >
                    <div
                      onclick="window.reactHasLoaded && (document.querySelector('.comment-preview-0x${story.index}').style.display = 'none', window.dispatchEvent(new CustomEvent('open-comments-0x${story.index}')));"
                      style="width: 100%; background-color: rgba(0, 0, 0, 0.05);padding: 7px 9px;border-radius: 2px;"
                    >
                      <div style="display: inline-flex; align-items: start;">
                        <img
                          src="${DOMPurify.sanitize(
                            story.lastComment.identity.safeAvatar,
                          )}"
                          alt="avatar"
                          style="border: 1px solid #ccc; width: ${size}px; height: ${size}px; border-radius: 2px; margin-right: 4px;"
                        />
                        <span style="font-weight: bold;"
                          >${DOMPurify.sanitize(
                            story.lastComment.identity.displayName,
                          )}:</span
                        >
                      </div>
                      <span> </span>
                      <span
                        >${truncateComment(
                          DOMPurify.sanitize(story.lastComment.title),
                        )}</span
                      >
                      <span> </span>
                    </div>
                  </div>`
                : null
            }
            ${
              path !== "/stories"
                ? html`<div
                    class="comment-section"
                    data-comment-count="${commentCount}"
                    data-story-index="0x${story.index}"
                  ></div>`
                : null
            }
          </div>
        </td>
      </tr>
    `;
  };
};

export const ChatsSVG = (
  style = "color: rgba(0,0,0,0.65); width: 25px;",
) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
export default row;
