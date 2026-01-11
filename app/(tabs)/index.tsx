import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const LAW_LINKS = [
  {
    title: "Ligji mbi Trafikun Rrugor",
    subtitle: "Lexo tekstin • /laws/ligjitrafikut",
    href: "/laws/ligjitrafikut",
  },
  {
    title: "Ligji për Patentë Shofer",
    subtitle: "Lexo tekstin • /laws/ligjiperpatentshofer",
    href: "/laws/ligjiperpatentshofer",
  },
  {
    title: "Ligji për Automjete",
    subtitle: "Lexo tekstin • /laws/ligjiperautomjete",
    href: "/laws/ligjiperautomjete",
  },
];

export default function HomeScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      {/* Navbar */}
      <View style={styles.nav}>
        <Text style={styles.brand}>ILaw</Text>

        <View style={styles.navRight}>
          <Link href="/" asChild>
            <Pressable>
              <Text style={styles.link}>Home</Text>
            </Pressable>
          </Link>

          <Link href="/modal" asChild>
            <Pressable>
              <Text style={styles.link}>About</Text>
            </Pressable>
          </Link>

          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>Contact</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.h1}>ILaw — Ligjet në tekst</Text>
        <Text style={styles.p}>
          Ky web ka per qellim informimin mbi ligjin e trafikut.
        </Text>

        <View style={styles.row}>
          <Pressable style={styles.primary}>
            <Text style={styles.primaryText}>Get Started</Text>
          </Pressable>

          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Learn More</Text>
          </Pressable>
        </View>
      </View>

      {/* Laws Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ligjet</Text>
        <Text style={styles.sectionDesc}>
          Kliko njërin ligj për me e lexu tekstin dhe me bo kërkim brenda.
        </Text>

        <View style={styles.grid}>
          {LAW_LINKS.map((x) => (
            <Link key={x.href} href={x.href as any} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{x.title}</Text>
                <Text style={styles.cardText}>{x.subtitle}</Text>

                <View style={styles.cardButtons}>
                  <View style={styles.primary}>
                    <Text style={styles.primaryText}>Hap</Text>
                  </View>
                  <View style={styles.secondary}>
                    <Text style={styles.secondaryText}>Lexo</Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} ILaw</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0f" },
  container: { padding: 20, gap: 16, maxWidth: 1100, alignSelf: "center", width: "100%" },

  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  brand: { color: "white", fontSize: 18, fontWeight: "800" },
  navRight: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  link: { color: "rgba(255,255,255,0.85)" },
  cta: { backgroundColor: "white", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  ctaText: { color: "#0b0b0f", fontWeight: "800" },

  hero: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  h1: { color: "white", fontSize: 34, fontWeight: "900" },
  p: { color: "rgba(255,255,255,0.7)", marginTop: 10, fontSize: 16, lineHeight: 22 },
  row: { flexDirection: "row", gap: 12, marginTop: 16, flexWrap: "wrap" },
  primary: { backgroundColor: "white", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  primaryText: { color: "#0b0b0f", fontWeight: "800" },
  secondary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  secondaryText: { color: "white", fontWeight: "700" },

  section: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  sectionTitle: { color: "white", fontSize: 20, fontWeight: "900" },
  sectionDesc: { color: "rgba(255,255,255,0.7)", marginTop: 8, lineHeight: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  card: {
    flexBasis: 260,
    flexGrow: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  cardText: { color: "rgba(255,255,255,0.7)", marginTop: 8, lineHeight: 20 },
  cardButtons: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },

  footer: { color: "rgba(255,255,255,0.5)", paddingVertical: 12 },
});
