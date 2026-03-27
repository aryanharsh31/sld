import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { appProfileService } from '../../services/appProfileService';

interface GreetingProps {
  styles?: any;
}

const GreetingComponent: React.FC<GreetingProps> = ({ styles: externalStyles }) => {
  const [firstName, setFirstName] = useState<string>('Student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadName = async () => {
      try {
        setLoading(true);
        const displayName = await appProfileService.getDisplayName();
        setFirstName(displayName);
      } catch (error) {
        console.error('Error fetching user name:', error);
        setFirstName('Student');
      } finally {
        setLoading(false);
      }
    };

    loadName();
  }, []);

  const componentStyles = externalStyles || defaultStyles;

  return (
    <View style={{ flex: 1 }}>
      <Text style={componentStyles.greeting}>
        {loading ? 'Hello' : `Hello, ${firstName}`}
      </Text>
      <Text style={componentStyles.subtitle}>
        Ready for writing, speaking, and learning support?
      </Text>
    </View>
  );
};

const defaultStyles = StyleSheet.create({
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});

export default GreetingComponent;
