#!/usr/bin/env python3
"""Write Syndica Bank's opening book: the seed CSVs `build` loads (step build/06-opening).

  python3 scripts/gen-seed.py      rewrite spine/build/06-opening/files/seed/*.csv and build/06-open.sql

The data is synthetic, owned, and DELIBERATELY AWKWARD — later courses depend on every case below, so
change it only with a full spine replay and a review of every scene that quotes it:

  * a JOINT account (1013: Chloe Price and Marcus Reid)                    -> duplicate amplification
  * an account with no postings (Amelia's, opened by hand in build/03)     -> outer joins
  * customers with no account (Grace Lin, and the manual Priya Shah)       -> outer joins, anti-joins
  * NULL phones; NULL closed_on meaning "still open"; one closed account   -> NULL logic
  * a DUPLICATE customer: Priya Shah, two emails (build/05 + this book)    -> dedup, merge
  * posting dates in ISLANDS, and Tom Walsh overdrawn three days running   -> gaps and islands, windows
  * a REVERSED transaction (a fee charged in error)                        -> reversals
  * a transfer chain A -> B -> C -> A (Olivia -> Hassan -> Aisha -> Olivia) -> recursive CTE, CYCLE

Ids come from ranges of their own (customers 101+, accounts 1001+, transactions 5001+, postings
9001+), so they can never meet the rows the team created by hand; build/06-open.sql then restarts each
identity past the loaded rows — COPY writes explicit ids without moving the identity.

Double entry: every transaction's postings sum to zero. A posting's amount is signed from its
account's side: money in (+) or out (-). Money from outside the bank passes through the internal
account 1001 "external clearing".
"""
from decimal import Decimal as D
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'spine' / 'build' / '06-opening' / 'files'

CUSTOMERS = [  # id, full_name, email, phone, kyc_status, joined_on
    (101, 'Olivia Bennett', 'olivia.bennett@example.com', '+44 7700 900111', 'verified', '2026-09-02'),
    (102, 'Hassan Ali', 'hassan.ali@example.com', '+44 7700 900112', 'verified', '2026-09-02'),
    (103, 'Chloe Price', 'chloe.price@example.com', None, 'verified', '2026-09-03'),
    (104, 'Marcus Reid', 'marcus.reid@example.com', '+44 7700 900114', 'verified', '2026-09-03'),
    (105, 'Priya Shah', 'priya.shah@example.com', '+44 7700 900115', 'verified', '2026-09-07'),
    (106, 'Tom Walsh', 'tom.walsh@example.com', None, 'pending', '2026-09-10'),
    (107, 'Sofia Rossi', 'sofia.rossi@example.com', '+44 7700 900117', 'verified', '2026-09-14'),
    (108, 'Ben Carter', 'ben.carter@example.com', '+44 7700 900118', 'verified', '2026-09-21'),
    (109, 'Aisha Khan', 'aisha.khan@example.com', '+44 7700 900119', 'verified', '2026-10-01'),
    (110, 'Liam Murphy', 'liam.murphy@example.com', '+44 7700 900120', 'pending', '2026-10-12'),
]

ACCOUNTS = [  # id, account_no, kind, branch_code, currency, overdraft_limit, opened_on, closed_on
    (1001, 'SY00000001', 'internal', 'LDS', 'GBP', '0.00', '2026-09-01', None),  # external clearing
    (1002, 'SY00000002', 'internal', 'LDS', 'GBP', '0.00', '2026-09-01', None),  # fee income
    (1003, 'SY00000003', 'internal', 'LDS', 'GBP', '0.00', '2026-09-01', None),  # interest paid
    (1004, 'SY00000004', 'internal', 'LDS', 'GBP', '0.00', '2026-09-01', None),  # card settlement
    (1011, 'SY40000011', 'current', 'LDS', 'GBP', '500.00', '2026-09-02', None),  # Olivia
    (1012, 'SY40000012', 'current', 'BRS', 'GBP', '0.00', '2026-09-02', None),  # Hassan
    (1013, 'SY40000013', 'current', 'MAN', 'GBP', '250.00', '2026-09-03', None),  # Chloe + Marcus
    (1014, 'SY40000014', 'savings', 'MAN', 'GBP', '0.00', '2026-09-03', None),  # Chloe
    (1015, 'SY40000015', 'current', 'LDS', 'GBP', '0.00', '2026-09-07', None),  # Priya (105)
    (1016, 'SY40000016', 'current', 'BRS', 'GBP', '100.00', '2026-09-10', None),  # Tom
    (1017, 'SY40000017', 'savings', 'BRS', 'GBP', '0.00', '2026-09-14', None),  # Sofia
    (1018, 'SY40000018', 'current', 'MAN', 'GBP', '0.00', '2026-09-21', '2026-10-20'),  # Ben, closed
    (1019, 'SY40000019', 'current', 'LDS', 'GBP', '0.00', '2026-10-01', None),  # Aisha
    (1020, 'SY40000020', 'current', 'MAN', 'GBP', '0.00', '2026-10-12', None),  # Liam
    (1021, 'SY40000021', 'current', 'LDS', 'GBP', '0.00', '2026-09-01', None),  # Daniel (customer 2)
]

HOLDERS = [(1011, 101), (1012, 102), (1013, 103), (1013, 104), (1014, 103), (1015, 105), (1016, 106),
           (1017, 107), (1018, 108), (1019, 109), (1020, 110), (1021, 2)]

CLEARING, FEES, INTEREST, CARDS = 1001, 1002, 1003, 1004

# kind, reference, booked_at (Europe/London local; BST until 25 Oct), [(account, amount), ...]
# Account-side legs only; the counter-leg is derived per kind below.
TXNS = []


def txn(kind, ref, at, legs):
    TXNS.append((kind, ref, at, legs))


def deposit(acc, amt, at, ref='cash deposit'):
    txn('deposit', ref, at, [(acc, D(amt)), (CLEARING, -D(amt))])


def withdrawal(acc, amt, at, ref='ATM withdrawal'):
    txn('withdrawal', ref, at, [(acc, -D(amt)), (CLEARING, D(amt))])


def card(acc, amt, at, ref):
    txn('card', ref, at, [(acc, -D(amt)), (CARDS, D(amt))])


def transfer(src, dst, amt, at, ref):
    txn('transfer', ref, at, [(src, -D(amt)), (dst, D(amt))])


def fee(acc, amt, at, ref):
    txn('fee', ref, at, [(acc, -D(amt)), (FEES, D(amt))])


def interest(acc, amt, at):
    txn('interest', 'monthly interest', at, [(acc, D(amt)), (INTEREST, -D(amt))])


# September: accounts funded
deposit(1011, '2400.00', '2026-09-02 09:12', 'salary')
deposit(1012, '1850.00', '2026-09-02 10:40', 'salary')
deposit(1013, '3100.00', '2026-09-03 11:05', 'salary')
deposit(1014, '5000.00', '2026-09-03 11:20', 'opening deposit')
deposit(1015, '1200.00', '2026-09-07 14:02')
deposit(1016, '300.00', '2026-09-10 16:45')
deposit(1017, '750.00', '2026-09-14 09:30', 'opening deposit')
deposit(1018, '400.00', '2026-09-21 12:00')
deposit(1021, '950.00', '2026-09-22 13:10', 'salary')
card(1011, '42.80', '2026-09-04 18:22', 'GREENGROCER LEEDS')
card(1013, '86.15', '2026-09-05 19:40', 'NORTHERN RAIL')
card(1012, '23.50', '2026-09-08 12:31', 'CAFE LUMEN')
withdrawal(1016, '120.00', '2026-09-12 21:05')
card(1015, '64.99', '2026-09-15 20:15', 'BOOKSHOP MAN')
withdrawal(1018, '400.00', '2026-09-28 10:00', 'branch withdrawal')
interest(1014, '4.11', '2026-09-30 23:00')
# October: the chain Olivia -> Hassan -> Aisha -> Olivia (a cycle)
deposit(1019, '600.00', '2026-10-01 09:00', 'opening deposit')
transfer(1011, 1012, '150.00', '2026-10-02 08:30', 'rent share')
transfer(1012, 1019, '150.00', '2026-10-02 12:10', 'loan')
transfer(1019, 1011, '150.00', '2026-10-03 17:45', 'loan repaid')
# Tom: islands of activity, overdrawn 6, 7, 8 October
card(1016, '95.00', '2026-10-05 13:00', 'GARAGE BRISTOL')
card(1016, '140.00', '2026-10-06 11:20', 'TYRES DIRECT')
fee(1016, '15.00', '2026-10-07 00:05', 'overdraft fee')
deposit(1016, '400.00', '2026-10-09 09:15', 'salary')
card(1016, '18.40', '2026-10-13 19:30', 'CAFE LUMEN')
card(1016, '22.10', '2026-10-14 19:45', 'CAFE LUMEN')
# a fee charged in error, then reversed
fee(1013, '25.00', '2026-10-15 00:05', 'overdraft fee')
txn('reversal', 'fee charged in error', '2026-10-16 10:30', [(1013, D('25.00')), (FEES, D('-25.00'))])
deposit(1020, '250.00', '2026-10-12 15:00', 'opening deposit')
card(1013, '210.40', '2026-10-17 11:11', 'HOMEWARE MAN')
transfer(1013, 1014, '500.00', '2026-10-20 09:00', 'to savings')
card(1011, '58.25', '2026-10-21 18:05', 'GREENGROCER LEEDS')
withdrawal(1012, '200.00', '2026-10-24 22:40')
card(1021, '12.60', '2026-10-27 08:15', 'CAFE LUMEN')
card(1019, '33.00', '2026-10-28 13:30', 'PHARMACY LEEDS')
interest(1014, '4.95', '2026-10-31 23:00')


def tz(local):
    """Europe/London offset for a local timestamp: BST (+01) until 25 Oct 2026 02:00, then GMT."""
    return local + ('+01' if local < '2026-10-25 02:00' else '+00')


def csv(v):
    if v is None:
        return ''
    s = str(v)
    return f'"{s}"' if any(c in s for c in ',"') else s


def main():
    (OUT / 'seed').mkdir(parents=True, exist_ok=True)
    (OUT / 'build').mkdir(parents=True, exist_ok=True)
    w = lambda name, header, rows: (OUT / 'seed' / name).write_text(header + '\n' + ''.join(','.join(csv(v) for v in r) + '\n' for r in rows))
    w('customers.csv', 'customer_id,full_name,email,phone,kyc_status,joined_on', CUSTOMERS)
    w('accounts.csv', 'account_id,account_no,kind,branch_code,currency,overdraft_limit,opened_on,closed_on', ACCOUNTS)
    w('account_holders.csv', 'account_id,customer_id', HOLDERS)
    # ids follow booking time, so a later id is never an earlier event
    TXNS.sort(key=lambda t: t[2])
    rev = next(i for i, t in enumerate(TXNS, start=1) if t[0] == 'reversal')
    fee_1013 = next(i for i, t in enumerate(TXNS, start=1) if t[0] == 'fee' and t[3][0][0] == 1013)
    REVERSES = {rev: fee_1013}
    txns, posts = [], []
    pid = 9001
    for i, (kind, ref, at, legs) in enumerate(TXNS, start=1):
        assert sum(a for _, a in legs) == 0, (kind, ref)
        tid = 5000 + i
        txns.append((tid, kind, ref, tz(at), 5000 + REVERSES[i] if i in REVERSES else None))
        for acc, amt in legs:
            posts.append((pid, tid, acc, f'{amt:.2f}'))
            pid += 1
    w('transactions.csv', 'txn_id,kind,reference,booked_at,reverses', txns)
    w('postings.csv', 'posting_id,txn_id,account_id,amount', posts)
    nxt = lambda rows: max(r[0] for r in rows) + 1
    (OUT / 'build' / '06-open.sql').write_text(f"""-- build/06-open.sql — load the opening book, parents before children.
-- The CSVs carry their own ids (customers 101+, accounts 1001+ ...).
\\copy core.customers FROM 'seed/customers.csv' CSV HEADER
\\copy core.accounts FROM 'seed/accounts.csv' CSV HEADER
\\copy core.account_holders FROM 'seed/account_holders.csv' CSV HEADER
\\copy core.transactions FROM 'seed/transactions.csv' CSV HEADER
\\copy core.postings FROM 'seed/postings.csv' CSV HEADER

-- COPY wrote explicit ids, so no identity moved: move each past its rows,
-- or one day an INSERT would hand out customer 101 again.
ALTER TABLE core.customers ALTER customer_id RESTART WITH {nxt(CUSTOMERS)};
ALTER TABLE core.accounts ALTER account_id RESTART WITH {nxt(ACCOUNTS)};
ALTER TABLE core.transactions ALTER txn_id RESTART WITH {nxt(txns)};
ALTER TABLE core.postings ALTER posting_id RESTART WITH {nxt(posts)};
""")
    print(f'{len(CUSTOMERS)} customers, {len(ACCOUNTS)} accounts, {len(HOLDERS)} holders, {len(txns)} transactions, {len(posts)} postings')


if __name__ == '__main__':
    main()
