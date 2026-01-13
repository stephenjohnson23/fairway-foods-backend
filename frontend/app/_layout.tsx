import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
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
      <Stack.Screen name="kitchen" />
      <Stack.Screen name="cashier" />
    </Stack>
  );
}
