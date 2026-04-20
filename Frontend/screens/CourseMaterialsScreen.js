import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import apiService from '../services/apiService';

const COLORS = {
    primary: '#03045e',
    white: '#FFFFFF',
    bg: '#F5F5F5',
};

export default function CourseMaterialsScreen() {
    const router = useRouter();
    const [course, setCourse] = useState('computerScience');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('admin_course');
            const effective = (stored || '').trim() || 'computerScience';
            setCourse(effective);
            const res = await apiService.listCourseMaterials(effective);
            setFiles(res.files || []);
        } catch (e) {
            Alert.alert('Error', e.error || e.message || 'Could not list files');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const pickAndUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: '*/*',
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            const name = asset.name || 'document.pdf';
            const lower = name.toLowerCase();
            if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.pptx')) {
                Alert.alert('Invalid file', 'Choose a PDF, DOCX, or PPTX file.');
                return;
            }
            setUploading(true);
            await apiService.uploadCourseMaterial(asset.uri, name, course);
            Alert.alert('Success', 'File was converted to embeddings for your course.');
            await loadList();
        } catch (e) {
            Alert.alert('Upload failed', e.error || e.message || 'Unknown error');
        } finally {
            setUploading(false);
        }
    };

    const onDelete = (item) => {
        Alert.alert('Delete', `Remove ${item.original_filename} from the vector store?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiService.deleteCourseMaterial(course, item.storage_id);
                        await loadList();
                    } catch (e) {
                        Alert.alert('Error', e.error || e.message);
                    }
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.85}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Course materials</Text>
                <View style={{ width: 40 }} />
            </View>
            <Text style={styles.hint}>
                Up to 6 files per course (oldest is removed when you add a 7th). Embeddings live under
                chroma_db/subjects. In chat use /course so answers use strong embedding matches, or full file text
                plus AI when the match is weak.
            </Text>
            <Text style={styles.courseLine}>Your course: {course}</Text>
            {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} /> : null}
            <TouchableOpacity
                style={[styles.btn, uploading && styles.btnDisabled]}
                onPress={pickAndUpload}
                disabled={uploading}
                activeOpacity={0.85}
            >
                <Text style={styles.btnText}>{uploading ? 'Uploading…' : 'Pick PDF / DOCX / PPTX'}</Text>
            </TouchableOpacity>
            <FlatList
                data={files}
                keyExtractor={(item) => item.storage_id}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.fileName}>{item.original_filename}</Text>
                            <Text style={styles.meta}>
                                {item.chunks} chunks · {item.uploaded_at}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => onDelete(item)} hitSlop={12} accessibilityLabel="Delete file">
                            <Ionicons name="trash-outline" size={22} color="#b00020" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    !loading ? <Text style={styles.empty}>No materials uploaded yet for this course.</Text> : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: 48,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    back: { padding: 8 },
    title: { fontSize: 18, fontWeight: '600', color: COLORS.primary },
    hint: { fontSize: 13, color: '#444', marginBottom: 8, lineHeight: 18 },
    courseLine: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
    btn: {
        backgroundColor: COLORS.primary,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: COLORS.white, fontWeight: '600' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#dde8d8',
    },
    fileName: { color: COLORS.primary, fontWeight: '500' },
    meta: { fontSize: 11, color: '#666', marginTop: 4 },
    empty: { textAlign: 'center', color: '#888', marginTop: 24 },
});
