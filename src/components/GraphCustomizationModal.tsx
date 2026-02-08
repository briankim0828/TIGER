import React, { useMemo } from 'react';
import { Modal } from 'react-native';
import { Box, Text, VStack, HStack, Pressable, Icon } from '@gluestack-ui/themed';
import { Feather } from '@expo/vector-icons';
import type { ProgramSplit } from '../types/ui';

export type GraphCustomizationModalProps = {
  visible: boolean;
  splits: ProgramSplit[];
  selectedSplitId: string | null;
  onClose: () => void;
  onSelectSplit: (splitId: string | null) => void;
};

const GraphCustomizationModal: React.FC<GraphCustomizationModalProps> = ({
  visible,
  splits,
  selectedSplitId,
  onClose,
  onSelectSplit,
}) => {
  const options = useMemo(() => {
    return [
      { id: null as string | null, name: 'All Splits' },
      ...(splits ?? []).map((s) => ({ id: s.id, name: s.name })),
    ];
  }, [splits]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Box flex={1} bg="rgba(0,0,0,0.6)" justifyContent="center" alignItems="center" px="$4">
        <Box bg="#12141A" borderRadius="$xl" p="$4" width="$full">
          <Pressable onPress={onClose} position="absolute" right={10} top={10} hitSlop={8}>
            {/* @ts-ignore */}
            <Icon as={Feather as any} name="x" color="$gray400" size="md" />
          </Pressable>

          <VStack space="md" mt="$2">
            <Text color="$textLight50" fontSize="$lg" fontWeight="$bold">
              Graph Customization
            </Text>

            <VStack space="xs">
              {options.map((opt) => {
                const selected = opt.id === selectedSplitId;
                return (
                  <Pressable
                    key={opt.id ?? 'all-splits'}
                    onPress={() => onSelectSplit(opt.id)}
                    bg={selected ? '#1E2028' : 'transparent'}
                    borderRadius="$lg"
                    px="$3"
                    py="$3"
                    sx={{
                      ':pressed': { opacity: 0.8 },
                    }}
                  >
                    <HStack alignItems="center" justifyContent="space-between">
                      <Text color="$textLight50" fontSize="$md" fontWeight={selected ? '$semibold' : '$normal'}>
                        {opt.name}
                      </Text>
                      {selected ? (
                        // @ts-ignore
                        <Icon as={Feather as any} name="check" color="$textLight50" size="sm" />
                      ) : (
                        <Box w={18} h={18} />
                      )}
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
          </VStack>
        </Box>
      </Box>
    </Modal>
  );
};

export default GraphCustomizationModal;
