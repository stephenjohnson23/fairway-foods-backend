import { Stack, usePathname } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Routes that should display in full desktop mode (no phone mockup)
const DESKTOP_ROUTES = [
  '/admin',
  '/admin-panel',
  '/user-management',
  '/course-management',
  '/menu-management',
  '/kitchen',
  '/cashier',
];

function WebWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // Check if current route should be displayed in full desktop mode
  const isDesktopRoute = DESKTOP_ROUTES.some(route => pathname.startsWith(route));
  
  // For admin/staff routes, show full desktop view
  if (isDesktopRoute) {
    return (
      <View style={styles.desktopContainer}>
        {children}
      </View>
    );
  }

  // For regular user routes, show phone mockup
  return (
    <View style={styles.webContainer}>
      <LinearGradient
        colors={['#1a472a', '#2e7d32', '#43a047']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.decorativeElements}>
        <View style={[styles.golfBall, styles.ball1]} />
        <View style={[styles.golfBall, styles.ball2]} />
        <View style={[styles.golfBall, styles.ball3]} />
      </View>
      <View style={styles.phoneFrame}>
        <View style={styles.phoneNotch} />
        <View style={styles.phoneScreen}>
          {children}
        </View>
        <View style={styles.phoneHomeBar} />
      </View>
      <View style={styles.branding}>
        <View style={styles.brandingText}>
          <View style={styles.logoIcon}>
            <View style={styles.flagPole} />
            <View style={styles.flag} />
          </View>
          <View>
            <View style={styles.brandTitle}>
              <View style={styles.titleText} />
            </View>
            <View style={styles.brandSubtitle}>
              <View style={styles.subtitleText} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <WebWrapper>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="select-course" />
        <Stack.Screen name="index" />
        <Stack.Screen name="menu" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="admin-panel" />
        <Stack.Screen name="kitchen" />
        <Stack.Screen name="cashier" />
        <Stack.Screen name="user-management" />
        <Stack.Screen name="course-management" />
        <Stack.Screen name="menu-management" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="forgot-password" />
      </Stack>
    </WebWrapper>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  webContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a472a',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorativeElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  golfBall: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  ball1: {
    top: -50,
    left: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  ball2: {
    bottom: -100,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  ball3: {
    top: '40%',
    left: '10%',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  phoneFrame: {
    width: 375,
    height: 750,
    backgroundColor: '#1a1a1a',
    borderRadius: 45,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  phoneNotch: {
    width: 150,
    height: 30,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: -25,
    zIndex: 10,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 35,
    overflow: 'hidden',
  },
  phoneHomeBar: {
    width: 120,
    height: 5,
    backgroundColor: '#666',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  branding: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  brandingText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  flagPole: {
    width: 3,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    bottom: 5,
  },
  flag: {
    width: 15,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    top: 5,
    left: 3,
  },
  brandTitle: {
    marginBottom: 4,
  },
  titleText: {
    width: 120,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  brandSubtitle: {},
  subtitleText: {
    width: 80,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
  },
});
