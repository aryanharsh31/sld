import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import NotebookFolders from '../ui/folders';
import WordSentenceScreen from '../reading/reading';
import WritingPracticeScreen from '../write/practice';
import Ionicons from '@expo/vector-icons/Ionicons';
import GreetingComponent from '../ui/greeting';
import GamesSection from '../games/GamesSection';
import { appProfileService } from '../../services/appProfileService';
import { progressTrackingService, AssistiveProgressSummary } from '../../services/progressTrackingService';
import { piIntegrationService } from '../../services/piIntegrationService';


interface HomeScreenProps {
  onNewNote: () => void;
  onBack?: () => void;
  folders: any[];
  setFolders: React.Dispatch<React.SetStateAction<any[]>>;
  onOpenFolder?: (folder: any) => void;
}

const HomeScreen: React.FC<HomeScreenProps & { navigation: any }> = ({ onNewNote, onBack, folders, setFolders, onOpenFolder, navigation }) => {
  const [showGames, setShowGames] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const [showWritingPractice, setShowWritingPractice] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'main' | 'notebooks'>('main');
  const [dashboard, setDashboard] = useState<AssistiveProgressSummary | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [piConnected, setPiConnected] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      const [profile, summary] = await Promise.all([
        appProfileService.getProfile(),
        progressTrackingService.getSummary(),
      ]);
      setPreferredLanguage(profile.preferredLanguage);
      setDashboard(summary);
      setPiConnected(await piIntegrationService.isConfigured());
    };

    loadDashboard().catch(error => console.error('Failed to load dashboard', error));
    const unsubscribe = navigation.addListener('focus', loadDashboard);
    return unsubscribe;
  }, [navigation]);

  if (showGames) {
    return <GamesSection onBack={() => setShowGames(false)} />;
  }

  if (showReading) {
    return <WordSentenceScreen goBack={() => setShowReading(false)} />;
  }

  if (showWritingPractice) {
    return <WritingPracticeScreen onBack={() => setShowWritingPractice(false)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C63FF" />
      
      {/* Header with gradient background */}
      <View style={styles.header}>
        <View style={styles.headerContentRow}>
          <View style={{ flex: 1 }}>
          <GreetingComponent styles={styles} />
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsIconContainer}
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toggle buttons below header */}
      <View style={styles.tabToggleContainer}>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'main' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('main')}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'main' && styles.tabButtonTextActive]}>Main Actions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'notebooks' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('notebooks')}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'notebooks' && styles.tabButtonTextActive]}>Notebooks</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {selectedTab === 'main' && (
          <View style={styles.gridContainer}>
            <View style={styles.dashboardRow}>
              <View style={[styles.dashboardCard, styles.progressCard]}>
                <Text style={styles.dashboardLabel}>Assistive Progress</Text>
                <Text style={styles.dashboardValue}>{dashboard?.notesSaved ?? 0} notes saved</Text>
                <Text style={styles.dashboardMeta}>
                  {dashboard?.voiceCaptures ?? 0} voice captures • {dashboard?.recognizedWords ?? 0} words supported
                </Text>
              </View>
              <View style={[styles.dashboardCard, styles.systemCard]}>
                <Text style={styles.dashboardLabel}>System Status</Text>
                <Text style={styles.dashboardValue}>{piConnected ? 'Pi 4 linked' : 'Pi 4 not set'}</Text>
                <Text style={styles.dashboardMeta}>
                  Language: {preferredLanguage.toUpperCase()} • Queue: {dashboard?.queuedSyncItems ?? 0}
                </Text>
              </View>
            </View>
            {/* First Row */}
            <View style={styles.cardRow}>
              <TouchableOpacity 
                style={[styles.optionCard, styles.cardCreateNote]} 
                onPress={onNewNote}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardIcon}>📝</Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>Create Note</Text>
                    <Text style={styles.cardDescription}>Start a new notebook entry</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionCard, styles.cardGames]} 
                onPress={() => setShowGames(true)}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardIcon}>🎮</Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>Math Games</Text>
                    <Text style={styles.cardDescription}>Learn Math through play</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Second Row */}
            <View style={styles.cardRow}>
              <TouchableOpacity 
                style={[styles.optionCard, styles.cardReading]} 
                onPress={() => setShowReading(true)}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardIcon}>📚</Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>Reading</Text>
                    <Text style={styles.cardDescription}>Improve comprehension</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionCard, styles.cardWriting]} 
                onPress={() => setShowWritingPractice(true)}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardIcon}>✍️</Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>Writing Practice</Text>
                    <Text style={styles.cardDescription}>Hone your writing skills</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {selectedTab === 'notebooks' && (
          <>
            <NotebookFolders folders={folders} setFolders={setFolders} onOpenFolder={onOpenFolder} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DCDAFE',
  },
  header: {
    backgroundColor: '#6C63FF',
    padding: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 2,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollContainer: {
    padding: 16,
    paddingTop: 30,
  },
  gridContainer: {
    marginBottom: 30,
    marginTop: -30,
  },
  dashboardRow: {
    marginBottom: 16,
    gap: 12,
  },
  dashboardCard: {
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  progressCard: {
    backgroundColor: '#FFF8E8',
  },
  systemCard: {
    backgroundColor: '#E9F5FF',
  },
  dashboardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A4A4A',
    marginBottom: 6,
  },
  dashboardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  dashboardMeta: {
    fontSize: 14,
    color: '#5F6C7B',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
 
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d3748',
  },
  seeAll: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  optionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 25,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    height: 150,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  cardIcon: {
    fontSize: 50,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 30,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cardCreateNote: {
    backgroundColor: '#6C63FF',
  },
  cardGames: {
    backgroundColor: '#FF9F43',
  },
  cardReading: {
    backgroundColor: '#4BC0C0',
  },
  cardWriting: {
    backgroundColor: '#9966FF',
  },
  tabToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  tabButton: {
    paddingVertical: 15,
    paddingHorizontal: 34,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
    marginBottom:20,
   
  },
  tabButtonActive: {
    backgroundColor: '#6C63FF',
  },
  tabButtonText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 24,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsIconContainer: {
    padding: 8,
  },
});

export default HomeScreen;
