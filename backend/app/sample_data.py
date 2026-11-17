import os
import pandas as pd
import numpy as np

def generate_sample_csvs(data_dir: str):
    os.makedirs(data_dir, exist_ok=True)
    np.random.seed(42)

    n_samples = 600
    tenure = np.random.randint(1, 72, size=n_samples)
    monthly_charges = np.random.uniform(20.0, 120.0, size=n_samples)
    total_charges = tenure * monthly_charges + np.random.normal(0, 10, size=n_samples)
    support_calls = np.random.poisson(lam=2, size=n_samples)
    contract = np.random.choice(["Month-to-month", "One year", "Two year"], size=n_samples, p=[0.5, 0.3, 0.2])
    tech_support = np.random.choice(["Yes", "No"], size=n_samples, p=[0.4, 0.6])
    paperless_billing = np.random.choice(["Yes", "No"], size=n_samples, p=[0.6, 0.4])

    churn_prob = 1 / (1 + np.exp(-(
        -1.5 
        + 0.03 * monthly_charges 
        - 0.04 * tenure 
        + 0.45 * support_calls 
        + (contract == "Month-to-month") * 0.8
        - (tech_support == "Yes") * 0.6
    )))
    churn = (np.random.rand(n_samples) < churn_prob).astype(int)

    df_churn = pd.DataFrame({
        "tenure_months": tenure,
        "monthly_charges": np.round(monthly_charges, 2),
        "total_charges": np.round(np.clip(total_charges, 20, None), 2),
        "support_calls": support_calls,
        "contract": contract,
        "tech_support": tech_support,
        "paperless_billing": paperless_billing,
        "churn": churn
    })
    churn_path = os.path.join(data_dir, "telecom_churn.csv")
    df_churn.to_csv(churn_path, index=False)

    n_credit = 500
    credit_score = np.random.normal(650, 80, size=n_credit).clip(350, 850)
    annual_income = np.random.lognormal(mean=10.5, sigma=0.5, size=n_credit)
    debt_to_income = np.random.uniform(5, 50, size=n_credit)
    loan_amount = np.random.uniform(2000, 45000, size=n_credit)
    open_credit_lines = np.random.randint(1, 20, size=n_credit)
    employed_years = np.random.exponential(scale=6, size=n_credit).clip(0, 40)

    default_logits = (
        2.5 
        - 0.006 * credit_score 
        + 0.05 * debt_to_income 
        + 0.00003 * loan_amount 
        - 0.04 * employed_years
    )
    default_prob = 1 / (1 + np.exp(-default_logits))
    default_flag = (np.random.rand(n_credit) < default_prob).astype(int)

    df_credit = pd.DataFrame({
        "credit_score": np.round(credit_score, 0).astype(int),
        "annual_income": np.round(annual_income, 2),
        "debt_to_income_ratio": np.round(debt_to_income, 2),
        "loan_amount": np.round(loan_amount, 2),
        "open_credit_lines": open_credit_lines,
        "employed_years": np.round(employed_years, 1),
        "default": default_flag
    })
    credit_path = os.path.join(data_dir, "credit_risk.csv")
    df_credit.to_csv(credit_path, index=False)

    return {
        "churn": churn_path,
        "credit": credit_path
    }

