import { Text, View } from 'react-native';

export default function Heading() {
    return (
        <View style={styles.headingTextWrap}>
            <Text style={styles.headingBig}>Smart</Text>
            <Text style={styles.headingBig}>Educational Companion</Text>
        </View>
    );
}

const styles = {
    headingTextWrap: {
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        paddingLeft: 10,
    },
    headingBig: {
        fontFamily: 'Griffter',
        fontSize: 32,
        color: '#03045e',
        textAlign: 'center',
        lineHeight: 36,
        flexWrap: 'wrap',
    },
};