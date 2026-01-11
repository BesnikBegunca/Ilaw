import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function About() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 24 }}>About Page</Text>
            <Link href="/">← Back Home</Link>
        </View>
    );
}
