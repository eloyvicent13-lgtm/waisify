import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import Colors from '../constants/Colors';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width * 0.92;

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export default function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const totalTabs = state.routes.length;
  const tabWidth = TAB_BAR_WIDTH / totalTabs;
  
  const translationX = useSharedValue(0);

  React.useEffect(() => {
    translationX.value = state.index * tabWidth;
  }, [state.index, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: withSpring(translationX.value, { damping: 20, stiffness: 280, mass: 0.6 }) }],
    };
  });

  return (
    <View style={styles.outerContainer}>
      <BlurView 
        intensity={30} 
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : 'dark'} 
        style={styles.blurContainer}
      >
        {/* Diagonal glass reflection */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.reflectionLine} />
        
        {/* Animated Background Indicator */}
        <Animated.View style={[styles.indicatorPill, { width: tabWidth - 16 }, animatedIndicatorStyle]} />

        <View style={styles.tabsWrapper}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            let iconName: keyof typeof Ionicons.glyphMap = 'home';
            if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
            else if (route.name === 'search') iconName = isFocused ? 'search' : 'search-outline';
            else if (route.name === 'library') iconName = isFocused ? 'library' : 'library-outline';
            else if (route.name === 'settings') iconName = isFocused ? 'settings' : 'settings-outline';

            const animatedIconStyle = useAnimatedStyle(() => {
              return {
                transform: [{
                  scale: withSpring(isFocused ? 1.15 : 1.0, {
                    stiffness: 300,
                    damping: 20
                  })
                }],
                opacity: withTiming(isFocused ? 1 : 0.55, { duration: 150 })
              };
            });

            return (
              <TouchableOpacity
                key={route.key}
                activeOpacity={0.8}
                onPress={onPress}
                style={[styles.tabButton, { width: tabWidth }]}
              >
                <Animated.View style={animatedIconStyle}>
                  <Ionicons
                    name={iconName}
                    size={22}
                    color={isFocused ? Colors.accentColor : Colors.textMain}
                  />
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 24,
    left: width * 0.04,
    width: TAB_BAR_WIDTH,
    borderRadius: 30,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  blurContainer: {
    height: 64,
    justifyContent: 'center',
  },
  reflectionLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  tabsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  tabButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorPill: {
    position: 'absolute',
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    left: 8,
  },
});
