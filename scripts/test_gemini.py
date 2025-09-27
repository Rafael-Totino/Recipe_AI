import os
import json
from pathlib import Path # Importa a biblioteca Path
import google.generativeai as genai
from dotenv import load_dotenv, find_dotenv

SYSTEM_PROMPT = Path('data/Prompt/SYSTEM_PROMPT.txt').read_text(encoding='utf-8').strip()

def analisar_receita():
    env_path = find_dotenv()
    
    if not env_path:
        raise FileNotFoundError("Arquivo .env não encontrado. Verifique se ele existe na raiz do projeto.")
        
    print(f"Arquivo .env encontrado em: {env_path}")
    load_dotenv(dotenv_path=env_path)
    api_key= os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError(f"A chave da API do Google não foi encontrada. Verifique se o arquivo {env_path} existe e está configurado corretamente.")

    genai.configure(api_key=api_key)

    #prompt_sistema = os.getenv("SYSTEM_PROMPT")
    texto_da_receita = """Quem é que não gosta de um bom creme de milho? Eu comia muito na minha infância e vai super bem com frango e porco. É super simples e se você seguir as dicas que eu der aqui no meio da receita, seu creme vai ficar muito melhor. Então aqui uma cebola, corta ela em cubus. Não precisa ser muito pequeno, não, porque depois a gente vai processar. Um fio de azeite. Não precisa de muito. Fogo baixo e vamos refogar a nossa cebola. Eu não quero dourar ela, eu só quero dar uma sueda, que nem diria meu amigo Clotroago. É super rápido, é só para ela ficar transparente. Eu vou usar milho enlatado mesmo, não tem problema, tranquilo, mas prático e rápido. E ele tem um adocicadinho que eu gosto. Aqui eu estou usando duas latas, tá? O importante é tirar a água delas. Refogou em fogo baixo por cinco minutinhos. Leite, a mesma proporção de milho para leite, leite integral, tá? Então aqui, 400 ml, porque cada lata tem 200 gramas. Agora é só cozinhar por mais cinco minutos. O milho já cozinhou no leite. Liquidificador. Não tem problema se subir essa natinha aqui, é tranquilo. Só bater bem por uns três minutos, velocidade máxima. Só uma coisa, enquanto o creme de milho está batendo, não esquece de se inscrever no canal, porque eu sei que tem muita gente que assiste os vídeos e não é inscrito, e muito like para esse vídeo. Agora sim, está pronto. Bem batido. E vamos peneirar. Mas se você gosta dos pedacinhos, não tem problema. Faz esse processo de peneirar, pega uma outra lata, abre e põe um pouquinho de milho inteiro. E o milho tem muito amido, vai agir e vai acabar engrossando naturalmente. Por isso que eu não uso creme de leite. Não tira o olho, tem que ficar sempre mexendo para não grudar no fundo. A gente finaliza com o sal. Não precisa pôr muito, que eu gosto do doce e do milho. Nossa, a manteiga derreteu já. De preferência, manteiga gelada. Vai assim mesmo, né gente? Na boa. Todo mundo que é família brasileira. Misturou, provo o sal. Cebule de froncê. Mas pode ser salsinha ou qualquer erva fresca que você quiser. Não me ponha erva seca, que é muito forte, tem um gosto estranho e eu não gosto de usar muito não. É só isso, agora eu vou montar o meu pratinho, que tem um acompanhamento. Olha só, mais uma vez eu juntei duas receitas da cozinha básica para fazer um prato. O primeiro foi o purê de batata com carne de panela e farofa, e agora creme de milho com frango grelhado, que está no card aqui como fazer. Sério, e é deliciosa, é uma das minhas comidas preferidas. Nossa, o sal é muito bom."""
    print(prompt_sistema)
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=SYSTEM_PROMPT
    )

    print("Enviando receita para a IA analisar...")
    try:
        response = model.generate_content(texto_da_receita)

        print("\n--- Resposta da IA (JSON) ---")
        clean_json_string = response.text.replace("```json", "").replace("```", "").strip()
        parsed_json = json.loads(clean_json_string)
        print(json.dumps(parsed_json, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"\nOcorreu um erro ao chamar a API: {e}")

analisar_receita()