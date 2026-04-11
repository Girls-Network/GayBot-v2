# Privacy Policy

**Effective Date:** 11th April 2026
**Last Updated:** 11th April 2026

This Privacy Policy explains how GayBot ("the Bot"), operated by Aria Rees & Clove Nytrix Doughmination Twilight ("we", "us", or "our"), collects, uses, and handles information when you use the Bot in your Discord server.

---

## 1. Information We Collect

### 1.1 Information Collected Automatically

When you interact with GayBot, the following data may be processed:

- **User IDs** – Your Discord user ID, used to process commands, apply any configured overrides (e.g. `/gaycounter`), and associate identity profile data with your account (e.g. `/identity`).
- **Server (Guild) IDs** – Used to deploy and manage slash commands within your server.
- **Message Content** – Message text is read in real time solely to detect keywords for automated emoji reactions. Message content is **not stored** beyond the instant it is processed.
- **Command Interactions** – Slash command inputs (e.g. search terms submitted via `/lgbtqsearch`) are processed to fulfil your request and are **not persistently stored**, except where you explicitly provide data for storage (see Section 1.2).

### 1.2 Information You Choose to Provide

The `/identity` command allows you to voluntarily store a personal LGBTQ+ identity profile. This may include:

- Pronouns
- Gender identity
- Sexual orientation
- Romantic orientation
- Pride flag
- A short bio

This data is stored persistently on our servers and is associated with your Discord user ID. You can view your stored data at any time using `/identity me`, and permanently delete it using `/identity clear`.

### 1.3 Information We Do Not Collect

We do not collect, store, or retain:

- The content of your messages beyond transient, in-memory processing.
- Personal information such as your name, email address, or IP address.
- Payment or financial information of any kind.
- Data from users who do not interact with the Bot.

---

## 2. How We Use Information

The information processed by GayBot is used solely to:

- Execute commands you initiate (e.g. `/ping`, `/gaycounter`, `/lgbtqsearch`, `/yuri`, `/hug`, `/identity`, `/help`).
- React to messages containing configured keywords with appropriate emoji.
- Deploy and register slash commands to Discord guilds.
- Store and retrieve identity profile data you have explicitly provided via `/identity`.
- Write error logs for debugging purposes. Error logs may contain command names and interaction IDs but do **not** contain message content or personal data.

---

## 3. Data Storage and Retention

GayBot stores identity profile data that you explicitly provide via `/identity set`. This data is saved as a JSON file on our host environment, keyed to your Discord user ID. It is retained until you delete it using `/identity clear`, which permanently removes your profile and all associated fields.

**Error logs** are written locally to the host environment and contain only timestamps, error messages, and command context. These logs are retained temporarily for operational purposes and are not shared externally.

---

## 4. Third-Party Services

GayBot may interact with the following third-party services:

- **Discord API** – All Bot functionality is delivered via the Discord API. Discord's own [Privacy Policy](https://discord.com/privacy) governs how Discord handles your data.
- **GayBot API** – The `/lgbtqsearch` command queries the GayBot API to retrieve definitions. The search term you submit is sent to this API. No personally identifiable information is transmitted.

---

## 5. Data Sharing

We do not sell, rent, or share your data with any third parties, except as required by law or as described in Section 4 above.

---

## 6. Children's Privacy

GayBot is not directed at children under the age of 13. We do not knowingly collect data from children. If you believe a child has interacted with the Bot in a way that has resulted in data collection, please contact us.

---

## 7. Your Rights

Depending on your jurisdiction, you may have rights regarding your personal data, including the right to access, correct, or request deletion of data we hold about you.

- **Identity profile data** can be viewed via `/identity me` and permanently deleted via `/identity clear` at any time.
- For any other privacy-related queries or data requests, contact us at: [support@girlsnetwork.dev](mailto:support@girlsnetwork.dev)

---

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. Continued use of GayBot following any changes constitutes acceptance of the updated policy. The "Last Updated" date at the top of this document will reflect any changes.

---

## 9. Contact

Aria Rees & Clove Nytrix Doughmination Twilight
GitHub: [https://github.com/Girls-Network](https://github.com/Girls-Network)
Email: [support@girlsnetwork.dev](mailto:support@girlsnetwork.dev)