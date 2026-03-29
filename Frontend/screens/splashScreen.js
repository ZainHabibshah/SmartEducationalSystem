import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';


const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#F5F5F5', // light gray
  heading: '#03045e', // dark blue
  inputBg: '#03045e', // dark blue
  inputText: '#FFFFFF',
  arrow: '#03045e', // dark blue for icons
  link: '#023e8a', // soft blue
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
};

export default function SplashScreen() {
  return (
  <View style={[styles.container, { backgroundColor: COLORS.bg }]}> 
      <View style={styles.centerContent}>
        <View style={styles.headingRow}>
          <Image
            source={require('../assets/images/darkGreenLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headingTextWrap}>
            <Text style={[styles.headingBig, { color: COLORS.heading }]}>Smart</Text>
            <Text style={[styles.headingBig, { color: COLORS.heading }]}>Educational Companion</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottomSection}>
        <Text style={[styles.tagline, { color: COLORS.heading }]}> 
          Smart <Text style={[styles.bold, { color: COLORS.link }]}>Companion</Text>. Smarter <Text style={[styles.bold, { color: COLORS.link }]}>Future</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  headingBig: {
    fontFamily: 'Griffter',
    fontWeight: 'bold',
    fontSize: Math.max(56, Math.min(width * 0.16, height * 0.16)),
    color: COLORS.heading,
    textAlign: 'left',
    lineHeight: Math.max(60, Math.min(width * 0.17, height * 0.17)),
    flexWrap: 'wrap',
  },
  headingRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    maxWidth: 500,
    marginBottom: Math.max(height * 0.01, 8),
    minHeight: Math.max(40, Math.min(width * 0.11, height * 0.11)),
    alignSelf: 'center',
    left: "10%",
  },
  headingTextWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 'auto',
    maxWidth: '80%',
    flexWrap: 'wrap',
    paddingLeft: Math.max(width * 0.03, 10),
  },
  headingSmart: {
    fontFamily: 'Griffter',
    fontWeight: 'bold',
    fontSize: Math.max(40, Math.min(width * 0.11, height * 0.11)),
    color: '#1A1A1A',
    textAlign: 'center',
    marginLeft: Math.max(width * 0.02, 8),
    lineHeight: Math.max(40, Math.min(width * 0.11, height * 0.11)),
  },
  headingBig: {
    fontFamily: 'Griffter',
    fontWeight: 'bold',
    fontSize: Math.max(32, Math.min(width * 0.09, height * 0.09)),
    color: '#1A1A1A',
    textAlign: 'left',
    lineHeight: Math.max(36, Math.min(width * 0.1, height * 0.1)),
    flexWrap: 'wrap',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    width: '100%',
  },
  logo: {
    width: 119,
    height: 119,
    marginBottom: 0,
    marginLeft: 0,
    position: "relative",
    top: "20%",
    left: "-27%"
  },
  heading: {
    fontFamily: 'Griffter',
    fontWeight: 'bold',
    fontSize: Math.max(32, Math.min(width * 0.08, height * 0.08)),
    color: COLORS.heading,
    textAlign: 'center',
    marginBottom: Math.max(height * 0.01, 8),
    width: '90%',
    alignSelf: 'center',
  },
  bottomSection: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    position: 'absolute',
    bottom: Math.max(height * 0.06, 24),
    left : 10
  },
  tagline: {
    fontFamily: 'Outfit',
    fontSize: Math.max(16, Math.min(width * 0.045, height * 0.045)),
    color: COLORS.heading,
    textAlign: 'center',
    width: '90%',
    alignSelf: 'center',
  },
  bold: {
    fontFamily: 'Outfit',
    fontWeight: 'bold',
    color: COLORS.link,
  },
});