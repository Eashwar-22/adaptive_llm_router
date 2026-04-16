import re
from typing import Dict, Tuple, List
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

class SecurityManager:
    """
    PII Masking and Prompt Injection detection using Microsoft Presidio.
    """
    def __init__(self):
        print("Initializing Security Manager (Presidio/Spacy)...")
        self.analyzer = AnalyzerEngine()
        
        # Add a custom high-confidence CC recognizer for hyphenated/spaced numbers
        cc_pattern = Pattern(
            name="cc_pattern",
            regex=r"\b(?:\d[ -]*?){13,16}\b",
            score=0.85
        )
        cc_recognizer = PatternRecognizer(
            supported_entity="CREDIT_CARD",
            patterns=[cc_pattern],
            context=["card", "credit card", "cc", "visa", "mastercard"]
        )
        self.analyzer.registry.add_recognizer(cc_recognizer)
        
        self.anonymizer = AnonymizerEngine()
        
        # Persistence mapping for masked-to-original values
        self._masking_map: Dict[str, Dict[str, str]] = {}
        
        # Injection detection patterns
        self.injection_patterns = [
            r"ignore (all )?previous instructions",
            r"you are now (an? )?admin",
            r"system prompt:",
            r"reveal your secrets",
            r"bypass constraints",
            r"DAN mode",
            r"forget what I said"
        ]

    def process_prompt(self, request_id: str, prompt: str) -> Tuple[str, bool, dict]:
        """
        Analyzes and masks the prompt. Returns (masked_prompt, were_checks_triggered, security_metadata)
        """
        security_metadata = {
            "pii_detected": False,
            "injection_detected": False,
            "redactions": []
        }
        
        # Detection logic
        for pattern in self.injection_patterns:
            if re.search(pattern, prompt, re.IGNORECASE):
                security_metadata["injection_detected"] = True
                print(f"SECURITY ALERT: Prompt Injection detected in {request_id}")
                break
        
        # PII Analysis
        analysis_results = self.analyzer.analyze(text=prompt, entities=None, language='en')
        
        if analysis_results:
            security_metadata["pii_detected"] = True
            
            # Anonymization with custom operators for mapping recovery
            anonymized_result = self.anonymizer.anonymize(
                text=prompt,
                analyzer_results=analysis_results,
                operators={
                    "DEFAULT": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 10, "from_end": True}),
                    "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "<PHONE>"}),
                    "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "<EMAIL>"}),
                    "CREDIT_CARD": OperatorConfig("replace", {"new_value": "<CREDIT_CARD>"}),
                    "PERSON": OperatorConfig("replace", {"new_value": "<PERSON>"})
                }
            )
            
            masked_prompt = anonymized_result.text
            security_metadata["redactions"] = [res.entity_type for res in analysis_results]
            
            self._masking_map[request_id] = {
                "original": prompt,
                "masked": masked_prompt
            }
            
            return masked_prompt, True, security_metadata

        return prompt, security_metadata["injection_detected"], security_metadata

    def unmask_response(self, request_id: str, response: str) -> str:
        """
        Potentially swaps placeholders back to original values in the model's response.
        """
        # Feature to be polished in sub-phase 7.2
        return response

# Singleton instance
security_manager = SecurityManager()
