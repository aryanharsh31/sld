import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { authService } from '../../services/authService';
import { appProfileService, AssistiveProfile } from '../../services/appProfileService';
import { piIntegrationService, PiGatewayConfig } from '../../services/piIntegrationService';
import { progressTrackingService } from '../../services/progressTrackingService';

const DEFAULT_PI_CONFIG: PiGatewayConfig = {
  baseUrl: '',
  tabletId: '',
  apiKey: '',
};

const Settings = ({ navigation }: { navigation: any }) => {
  const [profile, setProfile] = useState<AssistiveProfile | null>(null);
  const [piConfig, setPiConfig] = useState<PiGatewayConfig>(DEFAULT_PI_CONFIG);
  const [queuedItems, setQueuedItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [loadedProfile, loadedPiConfig, summary] = await Promise.all([
        appProfileService.getProfile(),
        piIntegrationService.getConfig(),
        progressTrackingService.getSummary(),
      ]);
      setProfile(loadedProfile);
      setPiConfig(loadedPiConfig || DEFAULT_PI_CONFIG);
      setQueuedItems(summary.queuedSyncItems);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      await appProfileService.updateProfile(profile);
      await piIntegrationService.saveConfig(piConfig);
      Alert.alert('Saved', 'Assistive profile and Raspberry Pi settings were updated.');
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFlushQueue = async () => {
    try {
      await piIntegrationService.flushQueue();
      await loadSettings();
      Alert.alert('Sync Attempted', 'Queued items were sent to the Raspberry Pi if it was reachable.');
    } catch (error) {
      console.error('Error flushing queue:', error);
      Alert.alert('Error', 'Failed to flush the local queue');
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading assistive settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveIconButton} accessibilityLabel="Save settings">
          <Ionicons name="save-outline" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Profile</Text>
          <Field label="First Name" value={profile.firstName} onChangeText={(firstName) => setProfile({ ...profile, firstName })} />
          <Field label="Last Name" value={profile.lastName} onChangeText={(lastName) => setProfile({ ...profile, lastName })} />
          <Field label="Email" value={profile.email} onChangeText={(email) => setProfile({ ...profile, email })} keyboardType="email-address" />
          <Field label="Class" value={profile.classLevel ? String(profile.classLevel) : ''} onChangeText={(value) => setProfile({ ...profile, classLevel: value ? Number(value) : undefined })} keyboardType="numeric" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assistive Preferences</Text>
          <Field label="Preferred Language" value={profile.preferredLanguage} onChangeText={(preferredLanguage) => setProfile({ ...profile, preferredLanguage: preferredLanguage.toLowerCase() })} />
          <ToggleRow label="Speech Feedback" value={profile.speechFeedbackEnabled} onToggle={() => setProfile({ ...profile, speechFeedbackEnabled: !profile.speechFeedbackEnabled })} />
          <ToggleRow label="Text Simplification" value={profile.simplificationEnabled} onToggle={() => setProfile({ ...profile, simplificationEnabled: !profile.simplificationEnabled })} />
          <ToggleRow label="Cloud Sync Enabled" value={profile.cloudSyncEnabled} onToggle={() => setProfile({ ...profile, cloudSyncEnabled: !profile.cloudSyncEnabled })} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Raspberry Pi 4 Controller</Text>
          <Field label="Pi Base URL" value={piConfig.baseUrl || ''} onChangeText={(baseUrl) => setPiConfig({ ...piConfig, baseUrl })} placeholder="http://192.168.1.50:3000" autoCapitalize="none" />
          <Field label="Tablet ID" value={piConfig.tabletId || ''} onChangeText={(tabletId) => setPiConfig({ ...piConfig, tabletId })} autoCapitalize="none" />
          <Field label="API Key" value={piConfig.apiKey || ''} onChangeText={(apiKey) => setPiConfig({ ...piConfig, apiKey })} autoCapitalize="none" secureTextEntry />
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Offline Queue</Text>
            <Text style={styles.statusValue}>{queuedItems} pending sync items</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleFlushQueue}>
              <Text style={styles.secondaryButtonText}>Try Sync Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'words'}
      secureTextEntry={secureTextEntry}
    />
  </View>
);

const ToggleRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <TouchableOpacity style={[styles.togglePill, value && styles.togglePillActive]} onPress={onToggle}>
      <Text style={[styles.toggleText, value && styles.toggleTextActive]}>{value ? 'On' : 'Off'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 16,
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  saveIconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#223',
    marginBottom: 14,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d7deea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fbfcfe',
    color: '#223',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#223',
  },
  togglePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e9edf3',
  },
  togglePillActive: {
    backgroundColor: '#1f8efa',
  },
  toggleText: {
    color: '#223',
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#fff',
  },
  statusCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f7f9fc',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#223',
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 15,
    color: '#4d5b72',
    marginBottom: 12,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e5f0ff',
  },
  secondaryButtonText: {
    color: '#1565c0',
    fontWeight: '700',
  },
  buttonRow: {
    marginTop: 20,
    marginBottom: 30,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1f8efa',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: '#fff1f1',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  signOutText: {
    color: '#d92d20',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default Settings;
