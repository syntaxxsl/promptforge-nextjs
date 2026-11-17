    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin. Aşağıdaki fikir için TEK DOSYA halinde, eksiksiz, çalışan bir HTML/CSS/JS sitesi üret.
      
KURALLAR:
- SADECE kod yaz, açıklama yazma.
- Harici kütüphane kullanma (CDN yasak).
- Modern, responsive, mobil uyumlu olsun.
- Gerçek içerik koy.

FİKİR: ${prompt}

Sadece \`\`\`html ile başlayan kodu ver.`;

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, { model: 'gpt-4o-mini' })
      
      // AGRESİF METİN DÖNÜŞTÜRME (Hata Çözümü)
      let rawCode = '';
      if (typeof response === 'string') {
        rawCode = response;
      } else if (response && response.message && response.message.content) {
        rawCode = response.message.content;
      } else if (response && response.text) {
        rawCode = response.text;
      } else if (response && response.toString) {
        rawCode = response.toString();
      }

      // Kod bloklarını temizle
      if (rawCode.includes('```html')) {
        rawCode = rawCode.split('```html')[1].split('```')[0]
      } else if (rawCode.includes('```')) {
        rawCode = rawCode.split('```')[1].split('```')[0]
      }
      
      setCode(rawCode.trim())
    } catch (err: any) {
