// app/laws/[slug].tsx  (ose ku e ki slug.tsx)
// Mini AI Chat + Lexim i ligjit (JSON) + Nenet si cards brenda një carde
//
// IMPORTANT:
// 1) Kërkohet BACKEND (p.sh. Node/Express) që e thërret Gemini/OpenAI.
// 2) Ndrysho CHAT_API_URL me IP-në/URL-në tënde (mos e le "localhost" në Expo Go).
//
// Shembull:
// const CHAT_API_URL = "http://192.168.1.25:3001/chat";

import { Link, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

// JSON imports
import ligjiperautomjete from "../../data/laws/ligjiperautomjete.json";
import ligjiperpatentshofer from "../../data/laws/ligjiperpatentshofer.json";
import ligjitrafikut from "../../data/laws/ligjitrafikut.json";

// Map slug -> data
const LAWS: Record<string, any> = {
    ligjitrafikut,
    ligjiperpatentshofer,
    ligjiperautomjete,
};

// =====================
// Helpers: parsing
// =====================
function isHeadingLine(s: string) {
    const t = s.trim();
    if (/^(LIGJ|KAPITULLI|KREU|PJESA)\b/i.test(t)) return true;
    if (/^Neni\s+\d+/i.test(t)) return true;
    if (/^\d+\.\d+\./.test(t)) return true;
    if (/^[A-ZÇËÜÖÄ][A-ZÇËÜÖÄ\s\-]{6,}$/.test(t)) return true;
    return false;
}

function cleanupLine(s: string) {
    let t = (s ?? "").replace(/\f/g, " ").replace(/\r/g, "").trim();

    if (/GAZETA ZYRTARE/i.test(t)) return "";
    if (/PRISHTINË/i.test(t) && /GAZETA ZYRTARE/i.test(s)) return "";
    if (/^\d{1,3}$/.test(t)) return "";

    t = t.replace(/\s+/g, " ").trim();
    return t;
}

function linesToParagraphs(lines: string[]) {
    const cleaned = lines.map(cleanupLine).filter(Boolean);

    const paras: string[] = [];
    let buf: string[] = [];

    const flush = () => {
        if (buf.length) {
            const joined = buf.join(" ").replace(/\s+/g, " ").trim();
            if (joined) paras.push(joined);
            buf = [];
        }
    };

    for (const raw of cleaned) {
        const line = raw.trim();
        if (!line) {
            flush();
            continue;
        }

        if (isHeadingLine(line)) {
            flush();
            paras.push(line);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            flush();
            buf.push(line);
            flush();
            continue;
        }

        buf.push(line);
    }

    flush();
    return paras;
}

function normalizeToParagraphs(law: any): string[] {
    if (Array.isArray(law?.lines)) return linesToParagraphs(law.lines);

    if (Array.isArray(law?.paragraphs)) {
        return law.paragraphs
            .map((x: any) => (typeof x === "string" ? x.trim() : ""))
            .filter(Boolean);
    }

    if (typeof law?.content === "string") {
        return law.content
            .replace(/\r/g, "")
            .split(/\n{2,}/g)
            .map((p: string) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
            .filter(Boolean);
    }

    if (Array.isArray(law?.sections)) {
        const out: string[] = [];
        for (const s of law.sections) {
            const h =
                typeof s?.title === "string"
                    ? s.title.trim()
                    : typeof s?.h === "string"
                        ? s.h.trim()
                        : "";
            const body =
                typeof s?.body === "string"
                    ? s.body.trim()
                    : typeof s?.p === "string"
                        ? s.p.trim()
                        : "";

            if (h) out.push(h);
            if (body) out.push(body);
        }
        return out.filter(Boolean);
    }

    return [];
}

type ArticleCard = {
    id: string;
    title: string; // p.sh "Neni 1"
    body: string[]; // paragrafët brenda nenit
};

// Grupi paragrafët në “Neni X” cards
function groupIntoArticles(paras: string[]) {
    const articles: ArticleCard[] = [];
    let current: ArticleCard | null = null;
    let preamble: string[] = [];

    const flushPreambleIfNeeded = () => {
        if (preamble.length) {
            articles.push({
                id: "preamble",
                title: "Preambulë / Hyrje",
                body: [...preamble],
            });
            preamble = [];
        }
    };

    for (const p of paras) {
        const t = (p ?? "").trim();
        if (!t) continue;

        if (/^Neni\s+\d+/i.test(t)) {
            flushPreambleIfNeeded();
            if (current) articles.push(current);

            current = {
                id: t.toLowerCase().replace(/\s+/g, "-"),
                title: t,
                body: [],
            };
            continue;
        }

        if (!current) preamble.push(t);
        else current.body.push(t);
    }

    if (current) articles.push(current);
    flushPreambleIfNeeded();

    if (articles.length === 0) {
        const chunkSize = 10;
        const out: ArticleCard[] = [];
        for (let i = 0; i < paras.length; i += chunkSize) {
            out.push({
                id: `chunk-${i}`,
                title: `Pjesa ${Math.floor(i / chunkSize) + 1}`,
                body: paras.slice(i, i + chunkSize),
            });
        }
        return out;
    }

    return articles;
}

// =====================
// Helpers: mini “retrieval” për chat (RAG light)
// =====================
function scoreText(haystack: string, query: string) {
    // score i thjeshtë: sa herë përmendet query dhe disa fjalë kyçe
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    const h = haystack.toLowerCase();

    // me frazë të plotë
    let score = 0;
    const idx = h.indexOf(q);
    if (idx >= 0) score += 5;

    // me fjalë
    const words = q.split(/\s+/g).filter(Boolean);
    for (const w of words) {
        if (w.length < 3) continue;
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
        const matches = h.match(re);
        if (matches?.length) score += Math.min(5, matches.length);
    }

    return score;
}

function buildContextFromArticles(articles: ArticleCard[], userQuestion: string) {
    const q = userQuestion.trim();
    if (!q) return "";

    const ranked = articles
        .map((a) => {
            const hay = `${a.title}\n${a.body.join("\n")}`;
            return { a, s: scoreText(hay, q) };
        })
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .slice(0, 3);

    // Nëse s’gjet asgjë, mos e dërgo krejt ligjin (shumë i gjatë) – dërgo vetëm udhëzim
    if (ranked.length === 0) {
        return `Kontekst: S’gjej nen specifik me fjalët kyçe. Përgjigju duke kërkuar sqarime ose duke shpjeguar përgjithshëm.\n`;
    }

    // kufizo gjatësinë e tekstit (që mos të plas request-i)
    const MAX_CHARS = 3500;

    let ctx = `Kontekst nga ligji (përdore vetëm këtë tekst për përgjigje):\n`;
    for (const { a } of ranked) {
        ctx += `\n=== ${a.title} ===\n`;
        ctx += a.body.join("\n");
        ctx += `\n`;
        if (ctx.length > MAX_CHARS) break;
    }

    return ctx.slice(0, MAX_CHARS);
}

// =====================
// Chat types
// =====================
type ChatMsg = { id: string; role: "user" | "assistant"; text: string };

// Ndrysho këtë sipas backend-it tënd:
const CHAT_API_URL = "http://192.168.178.25:3001/chat";

export default function LawReader() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const key = (slug ?? "").toString().trim();
    const law = LAWS[key];

    const [q, setQ] = useState("");

    const title =
        typeof law?.title === "string" && law.title.trim()
            ? law.title.trim()
            : key || "Ligji";

    const paragraphs = useMemo(() => normalizeToParagraphs(law), [law]);
    const articles = useMemo(() => groupIntoArticles(paragraphs), [paragraphs]);

    const filteredArticles = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query) return articles;

        return articles.filter((a) => {
            const hay = (a.title + "\n" + a.body.join("\n")).toLowerCase();
            return hay.includes(query);
        });
    }, [articles, q]);

    // =====================
    // Chat state
    // =====================
    const [chatOpen, setChatOpen] = useState(true);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const [messages, setMessages] = useState<ChatMsg[]>([
        {
            id: "m0",
            role: "assistant",
            text:
                "Përshëndetje! Më pyet për nenet e këtij ligji (p.sh. “Çka thotë Neni 3?” ose “Çka kërkohet për patentë?”).",
        },
    ]);

    const scrollRef = useRef<ScrollView>(null);


    const sendChat = async () => {
        const msg = chatInput.trim();
        if (!msg || chatLoading) return;

        setChatError(null);
        setChatLoading(true);

        const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text: msg };
        setMessages((prev) => [...prev, userMsg]);
        setChatInput("");

        try {
            const context = buildContextFromArticles(articles, msg);

            // prompt i thjeshtë për backend-in (Gemini/OpenAI)
            const payload = {
                message: msg,
                context:
                    `Ti je asistent që shpjegon ligjet e Kosovës shkurt, qartë dhe pa shpikur. ` +
                    `Nëse konteksti s’ka përgjigje të saktë, thuaj “Nuk gjendet saktë në tekstin që kam” dhe kërko sqarim.\n\n` +
                    `Titulli: ${title}\nSlug: ${key}\n\n` +
                    context,
            };

            const r = await fetch(CHAT_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!r.ok) {
                const t = await r.text().catch(() => "");
                throw new Error(`HTTP ${r.status} ${t}`);
            }

            const data = await r.json();
            const answer = (data?.text ?? "").toString().trim() || "S’pata përgjigje.";

            const aiMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", text: answer };
            setMessages((prev) => [...prev, aiMsg]);

            // scroll poshtë
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 50);
        } catch (e: any) {
            setChatError(
                "S’u lidh chati me serverin. Kontrollo CHAT_API_URL (IP), a po punon serveri dhe a lejon CORS."
            );
            setMessages((prev) => [
                ...prev,
                {
                    id: `aerr-${Date.now()}`,
                    role: "assistant",
                    text: "Gabim lidhjeje. Provo prapë (ose kontrollo IP/Server).",
                },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    if (!law) {
        return (
            <View style={[styles.page, { padding: 20 }]}>
                <View style={styles.hero}>
                    <Text style={styles.h1}>Nuk u gjet ligji</Text>
                    <Text style={styles.p}>
                        Ky slug nuk ekziston:{" "}
                        <Text style={{ color: "white", fontWeight: "800" }}>{key || "(bosh)"}</Text>
                    </Text>

                    <Text style={styles.meta}>Provo njërin nga këta:</Text>

                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                        <Link href="/laws/ligjitrafikut" asChild>
                            <Pressable style={styles.secondary}>
                                <Text style={styles.secondaryText}>ligjitrafikut</Text>
                            </Pressable>
                        </Link>

                        <Link href="/laws/ligjiperpatentshofer" asChild>
                            <Pressable style={styles.secondary}>
                                <Text style={styles.secondaryText}>ligjiperpatentshofer</Text>
                            </Pressable>
                        </Link>

                        <Link href="/laws/ligjiperautomjete" asChild>
                            <Pressable style={styles.secondary}>
                                <Text style={styles.secondaryText}>ligjiperautomjete</Text>
                            </Pressable>
                        </Link>

                        <Link href="/" asChild>
                            <Pressable style={styles.primary}>
                                <Text style={styles.primaryText}>Kthehu Home</Text>
                            </Pressable>
                        </Link>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.page}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
            <ScrollView
                ref={scrollRef}
                style={styles.page}
                contentContainerStyle={styles.container}
            >

                {/* Header card */}
                <View style={styles.hero}>
                    <Text style={styles.h1}>{title}</Text>
                    <Text style={styles.p}>Kërko brenda tekstit dhe lexo nenet si “cards”.</Text>

                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder="Kërko në tekst..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        style={styles.search}
                    />

                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                        <Link href="/" asChild>
                            <Pressable style={styles.secondary}>
                                <Text style={styles.secondaryText}>Home</Text>
                            </Pressable>
                        </Link>

                        <Pressable style={styles.primary} onPress={() => setQ("")}>
                            <Text style={styles.primaryText}>Pastro</Text>
                        </Pressable>

                        <Pressable style={styles.secondary} onPress={() => setChatOpen((v) => !v)}>
                            <Text style={styles.secondaryText}>{chatOpen ? "Mbyll Chat" : "Hap Chat"}</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.meta}>
                        Paragrafe: {paragraphs.length} • Nene: {articles.length} • Shfaq:{" "}
                        {filteredArticles.length}
                    </Text>
                </View>

                {/* MINI CHAT CARD */}
                {chatOpen && (
                    <View style={styles.chatCard}>
                        <View style={styles.chatHeader}>
                            <Text style={styles.chatTitle}>Mini AI Chat</Text>
                            <View style={styles.chatBadge}>
                                <Text style={styles.chatBadgeText}>Ligji: {key}</Text>
                            </View>
                        </View>

                        {!!chatError && <Text style={styles.chatError}>{chatError}</Text>}

                        <View style={styles.chatMessages}>
                            {messages.map((m) => (
                                <View
                                    key={m.id}
                                    style={[
                                        styles.bubble,
                                        m.role === "user" ? styles.bubbleUser : styles.bubbleAI,
                                    ]}
                                >
                                    <Text style={styles.bubbleText}>{m.text}</Text>
                                </View>
                            ))}

                            {chatLoading && (
                                <View style={[styles.bubble, styles.bubbleAI, { flexDirection: "row", gap: 10 }]}>
                                    <ActivityIndicator />
                                    <Text style={styles.bubbleText}>Duke mendu...</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.chatInputRow}>
                            <TextInput
                                value={chatInput}
                                onChangeText={setChatInput}
                                placeholder="Pyet për nenet…"
                                placeholderTextColor="rgba(255,255,255,0.45)"
                                style={styles.chatInput}
                                multiline
                            />

                            <Pressable
                                style={[styles.sendBtn, chatLoading ? { opacity: 0.5 } : null]}
                                onPress={sendChat}
                                disabled={chatLoading}
                            >
                                <Text style={styles.sendBtnText}>Dërgo</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.chatHint}>
                            Tip: “Çka thotë Neni 1?”, “A ka afat 2 vite për shofer fillestar?”, “Ku
                            përmendet patenta ndërkombëtare?”
                        </Text>
                    </View>
                )}

                {/* OUTER CARD (krejt nenet brenda një carde) */}
                <View style={styles.outerCard}>
                    {filteredArticles.length === 0 ? (
                        <Text style={styles.paragraph}>S’ka rezultate për këtë kërkim.</Text>
                    ) : (
                        filteredArticles.map((a) => (
                            <View key={a.id} style={styles.articleCard}>
                                <View style={styles.articleHeaderRow}>
                                    <View style={styles.articleChip}>
                                        <Text style={styles.articleChipText}>{a.title}</Text>
                                    </View>
                                </View>

                                {a.body.length === 0 ? (
                                    <Text style={styles.paragraph}>—</Text>
                                ) : (
                                    a.body.map((p, idx) => (
                                        <Text key={`${a.id}-${idx}`} style={styles.paragraph}>
                                            {p}
                                        </Text>
                                    ))
                                )}
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0b0b0f" },
    container: {
        padding: 20,
        gap: 16,
        maxWidth: 1100,
        alignSelf: "center",
        width: "100%",
    },

    hero: {
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.06)",
        gap: 12,
    },
    h1: { color: "white", fontSize: 28, fontWeight: "900" },
    p: { color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 22 },

    search: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: "white",
        backgroundColor: "rgba(255,255,255,0.04)",
    },

    primary: {
        backgroundColor: "white",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
    },
    primaryText: { color: "#0b0b0f", fontWeight: "800" },

    secondary: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
    },
    secondaryText: { color: "white", fontWeight: "700" },

    meta: { color: "rgba(255,255,255,0.55)", marginTop: 4 },

    // Outer wrapper card (krejt cards brenda nje carde)
    outerCard: {
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.04)",
        gap: 14,
    },

    // Neni card
    articleCard: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.05)",
        gap: 10,
    },

    articleHeaderRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 2,
    },

    articleChip: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(0,0,0,0.25)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },

    articleChipText: {
        color: "white",
        fontWeight: "900",
        letterSpacing: 0.2,
    },

    paragraph: {
        color: "rgba(255,255,255,0.82)",
        lineHeight: 22,
        fontSize: 15,
    },

    // =====================
    // Chat styles
    // =====================
    chatCard: {
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.04)",
        gap: 12,
    },

    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },

    chatTitle: { color: "white", fontSize: 18, fontWeight: "900" },

    chatBadge: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(0,0,0,0.25)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    chatBadgeText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12 },

    chatError: { color: "#ffb4b4", lineHeight: 18 },

    chatMessages: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(0,0,0,0.20)",
        padding: 12,
        gap: 10,
    },

    bubble: {
        maxWidth: "92%",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },

    bubbleUser: {
        alignSelf: "flex-end",
        backgroundColor: "rgba(255,255,255,0.10)",
    },

    bubbleAI: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.06)",
    },

    bubbleText: { color: "rgba(255,255,255,0.88)", lineHeight: 20 },

    chatInputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },

    chatInput: {
        flex: 1,
        minHeight: 46,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: "white",
        backgroundColor: "rgba(255,255,255,0.04)",
    },

    sendBtn: {
        backgroundColor: "white",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    sendBtnText: { color: "#0b0b0f", fontWeight: "900" },

    chatHint: { color: "rgba(255,255,255,0.55)", lineHeight: 18, marginTop: 2 },
});
