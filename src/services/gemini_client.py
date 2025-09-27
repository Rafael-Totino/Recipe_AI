import google.generativeai as genai
from pathlib import Path
from typing import Any, Dict
import json

class GeminiClient:
    """
    Uma classe cliente para interagir com a API do Google Gemini.
    Encapsula a configuração, chamada e tratamento de erros básicos.
    """
    def __init__(self, api_key: str, model_name: str = 'gemini-1.5-flash-latest'):
        """
        Inicializa o cliente com a chave da API e o nome do modelo.
        """
        self.api_key = api_key
        self.model_name = model_name
        self._configure_api()

    def _configure_api(self):
        """Configura a biblioteca do genai com a chave fornecida."""
        if not self.api_key:
            raise ValueError("A chave da API do Google não foi fornecida.")
        genai.configure(api_key=self.api_key)
        
    def _load_system_prompt(self, file_path: Path) -> str:
        """Carrega o texto de um arquivo de prompt."""
        try:
            return file_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise FileNotFoundError(f"Arquivo de prompt não encontrado em: {file_path}")
        except Exception as e:
            raise IOError(f"Erro ao ler o arquivo de prompt: {e}")

    def generate_content(self, user_prompt: Dict[str, Any], system_prompt_path: Path) -> str:
        """
        Gera conteúdo usando o modelo Gemini com um prompt de sistema e um prompt do usuário.

        Args:
            user_prompt: O conteúdo/prompt enviado pelo usuário.
            system_prompt_path: O caminho para o arquivo .txt contendo o prompt do sistema.

        Returns:
            A resposta de texto gerada pelo modelo.
        """
        try:
            # Carrega a instrução de sistema do arquivo
            system_instruction = self._load_system_prompt(system_prompt_path)
            
            # Inicializa o modelo com a instrução de sistema
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction
            )
            
            user_prompt_string = json.dumps(user_prompt, indent=2, ensure_ascii=False)
            
            # Gera o conteúdo
            response = model.generate_content(user_prompt_string)
            
            return response.text

        except Exception as e:
            # Aqui você pode adicionar um logging mais detalhado do erro
            print(f"Ocorreu um erro ao chamar a API Gemini: {e}")
            # Você pode optar por retornar uma string vazia, None, ou levantar o erro novamente
            # dependendo de como sua aplicação principal deve se comportar em caso de falha.
            raise e