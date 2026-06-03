export function applyAdminBilingualization(root: ParentNode, language: string) {
  const target = String(language || "en").toLowerCase().startsWith("bn") ? "bn" : "en";
  const exact: Record<string, string> = target === "bn"
    ? {
        "SMS Templates": "এসএমএস টেমপ্লেট",
        "SMS Logs": "এসএমএস লগ",
        "Role & Permission Management": "রোল ও পারমিশন ম্যানেজমেন্ট",
        "Platform Reports": "প্ল্যাটফর্ম রিপোর্ট",
        "Feature Control": "ফিচার কন্ট্রোল",
        "Domain Management": "ডোমেইন ম্যানেজমেন্ট",
        "Back to agencies": "এজেন্সি তালিকায় ফিরে যান",
        "Loading tenant details...": "টেন্যান্ট তথ্য লোড হচ্ছে...",
        "Tenant not found.": "টেন্যান্ট পাওয়া যায়নি।"
      }
    : {
        "এসএমএস টেমপ্লেট": "SMS Templates",
        "এসএমএস লগ": "SMS Logs",
        "রোল ও পারমিশন ম্যানেজমেন্ট": "Role & Permission Management",
        "প্ল্যাটফর্ম রিপোর্ট": "Platform Reports",
        "ফিচার কন্ট্রোল": "Feature Control",
        "ডোমেইন ম্যানেজমেন্ট": "Domain Management",
        "এজেন্সি তালিকায় ফিরে যান": "Back to agencies",
        "টেন্যান্ট তথ্য লোড হচ্ছে...": "Loading tenant details...",
        "টেন্যান্ট পাওয়া যায়নি।": "Tenant not found."
      };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  nodes.forEach((node) => {
    const raw = node.textContent || "";
    const trimmed = raw.trim();
    if (!trimmed) return;
    const translated = exact[trimmed];
    if (translated) {
      node.textContent = raw.replace(trimmed, translated);
    }
  });
}
