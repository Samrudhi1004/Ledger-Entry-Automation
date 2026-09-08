import re

file_path = "D:/lihatech/ledger/Ledger-Entry-Automation/backend/apps/inspections/services.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# For `_get_cached_parameter`, we need to cache a dict and reconstruct a dummy InspectionParameter on retrieval 
# so that we don't break ToleranceValidator that expects an object with those attributes.

original_get_cached_param = """    if param:
        cache.set(cache_key, param, timeout=3600)
    return param"""

fixed_get_cached_param = """    if param:
        # Cache dict instead of ORM object (NEW-H2)
        cache_data = {
            'id': param.id,
            'parameter_code': param.parameter_code,
            'parameter_name': param.parameter_name,
            'nominal_value': float(param.nominal_value) if param.nominal_value else 0.0,
            'upper_limit': float(param.upper_limit) if param.upper_limit else 0.0,
            'lower_limit': float(param.lower_limit) if param.lower_limit else 0.0,
            'is_critical': param.is_critical,
        }
        cache.set(cache_key, cache_data, timeout=3600)
    return param"""

# We also need to intercept the cached value at the top of the function to rebuild it (or adapt ToleranceValidator, 
# but making a dummy class is safer and keeps the rest of the code identical).

old_top_param = """    cached_param = cache.get(cache_key)
    if cached_param is not None:
        return cached_param"""

new_top_param = """    cached_param = cache.get(cache_key)
    if cached_param is not None:
        # If it's a dict (from new cache format), we can use it, but ToleranceValidator expects an object.
        # However, Python handles dot notation via namedtuple/dataclass, or we can just reconstruct a basic object
        if isinstance(cached_param, dict):
            class DummyParam: pass
            p = DummyParam()
            for k, v in cached_param.items(): setattr(p, k, v)
            return p
        return cached_param"""


# Same for `_get_cached_process_parameter` which is basically identical

original_get_cached_proc_param = """    if proc_param:
        cache.set(cache_key, proc_param, timeout=3600)
    return proc_param"""

fixed_get_cached_proc_param = """    if proc_param:
        # Cache dict instead of ORM object
        cache_data = {
            'id': proc_param.id,
            'parameter_code': proc_param.parameter_code,
            'parameter_name': proc_param.parameter_name,
            'target_value': float(proc_param.target_value) if proc_param.target_value else 0.0,
            'unit': proc_param.unit,
        }
        cache.set(cache_key, cache_data, timeout=3600)
    return proc_param"""

old_top_proc_param = """    cached_proc_param = cache.get(cache_key)
    if cached_proc_param is not None:
        return cached_proc_param"""

new_top_proc_param = """    cached_proc_param = cache.get(cache_key)
    if cached_proc_param is not None:
        if isinstance(cached_proc_param, dict):
            class DummyProcParam: pass
            p = DummyProcParam()
            for k, v in cached_proc_param.items(): setattr(p, k, v)
            return p
        return cached_proc_param"""

content = content.replace(original_get_cached_param, fixed_get_cached_param)
content = content.replace(old_top_param, new_top_param)
content = content.replace(original_get_cached_proc_param, fixed_get_cached_proc_param)
content = content.replace(old_top_proc_param, new_top_proc_param)

# Also clear the Redis cache briefly so we don't pick up old corrupted pickeled objects
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
