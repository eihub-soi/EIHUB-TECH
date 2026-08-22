import re

def clean_d1_client():
    with open('src/lib/d1_client.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove cleanRow logic for notifications and activity_logs
    content = re.sub(
        r'  if \(tableName === "notifications"\) {.*?  }\n\n',
        '',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'  if \(tableName === "activity_logs" && typeof cleaned.details === "string"\) {.*?  }\n\n',
        '',
        content,
        flags=re.DOTALL
    )

    # Replace auth logic blocks
    content = re.sub(
        r'    async signInWithPassword\(\{ email, password \}: any\) \{.*?\n    \},',
        '    async signInWithPassword({ email, password }: any) {\n      return { data: null, error: { message: "Please use Firebase Authentication instead." } };\n    },',
        content,
        flags=re.DOTALL
    )
    
    content = re.sub(
        r'    async signUp\(\{ email, password \}: any\) \{.*?\n    \},',
        '    async signUp({ email, password }: any) {\n      return { data: null, error: { message: "Please use Firebase Authentication instead." } };\n    },',
        content,
        flags=re.DOTALL
    )

    content = re.sub(
        r'    async resetPassword\(email: string, newPassword: string\) \{.*?\n    \}',
        '    async resetPassword(email: string, newPassword: string) {\n      return { error: { message: "Please use Firebase Authentication instead." } };\n    }',
        content,
        flags=re.DOTALL
    )
    
    with open('src/lib/d1_client.ts', 'w', encoding='utf-8') as f:
        f.write(content)

clean_d1_client()
