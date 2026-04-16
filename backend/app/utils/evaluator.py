import os
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase
from deepeval.models import DeepEvalBaseLLM
from groq import Groq
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

class GroqLLM(DeepEvalBaseLLM):
    """
    Custom LLM wrapper for DeepEval to use Groq models.
    """
    def __init__(self, model_name="llama-3.3-70b-versatile"):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model_name = model_name

    def load_model(self):
        return self.client

    def generate(self, prompt: str) -> str:
        chat_completion = self.client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=self.model_name,
            temperature=0,
        )
        return chat_completion.choices[0].message.content

    async def a_generate(self, prompt: str) -> str:
        # DeepEval async generate implementation
        return self.generate(prompt)

    def get_model_name(self):
        return self.model_name

class QualityEvaluator:
    def __init__(self):
        # We use Llama-3-70b on Groq as the "Judge"
        self.model = GroqLLM()
        
        # Define G-Eval metric for general quality
        # G-Eval is a flexible metric that uses an LLM to score based on criteria
        self.quality_metric = GEval(
            name="Quality",
            criteria="Determine whether the response is coherent, helpful, and accurate based on the prompt.",
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            model=self.model
        )

    def evaluate(self, prompt: str, response: str):
        """
        Evaluates a prompt-response pair and returns a score and reason.
        """
        if not response or len(response.strip()) < 5:
            return {"score": 0.0, "reason": "Response too short to evaluate", "metrics": {}}

        test_case = LLMTestCase(input=prompt, actual_output=response)
        
        try:
            self.quality_metric.measure(test_case)
            scaled_score = self.quality_metric.score * 10
            return {
                "score": scaled_score,
                "reason": self.quality_metric.reason,
                "metrics": {
                    "quality": scaled_score,
                    "reason": self.quality_metric.reason
                }
            }
        except Exception as e:
            print(f"Evaluation Error: {e}")
            return {"score": 0.0, "reason": f"Evaluation failed: {str(e)}", "metrics": {}}

if __name__ == "__main__":
    # Quick test
    evaluator = QualityEvaluator()
    result = evaluator.evaluate("What is the capital of France?", "The capital of France is Paris.")
    print(f"Score: {result['score']}")
    print(f"Reason: {result['reason']}")
